// CV distribution background worker.
//
// Woken by pg_net (see migration 20261113120000_cv_distribution_v2.sql) whenever
// a job is queued or due. Answers 202 immediately and drains the queue in the
// background so callers never wait on distribution work.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.105.4";
import {
  allocate,
  cvReadinessProblems,
  DEFAULT_CV_REQUIREMENTS,
  EMPLOYER_RESET_PATCH,
  isPastPointOfNoReturn,
  isTrainee,
  normCountry,
  type AllocCandidate,
  type AllocOffice,
} from "../_shared/cv-distribution-core.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const WORKER_SECRET = Deno.env.get("CV_WORKER_SECRET") ?? "";
const TIME_BUDGET_MS = 110_000;
const REPORT_LIST_CAP = 200;

const db: SupabaseClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// ── Types ─────────────────────────────────────────────────────────────────────

type Job = {
  id: string;
  manager_id: string;
  kind: "distribute" | "expiry" | "office_locked" | "manual_send";
  trigger: "manual" | "scheduled" | "system";
  payload: Record<string, unknown>;
};

type Cand = {
  id: string;
  full_name: string | null;
  musaned_status: string | null;
  cv_sent_to: string | null;
  cv_sent_date: string | null;
  cv_resent_offices: unknown;
  availability_type: string | null;
  cv_approved: boolean | null;
  medical_status: string | null;
  coc_status: string | null;
  narrative: string | null;
  experience: string | null;
  passport_scan_url: string | null;
  full_photo_url: string | null;
  photo_url: string | null;
  status: string | null;
  selected_by: string | null;
  visa_status: string | null;
  ticket_status: string | null;
  created_at: string;
};

const CAND_COLS =
  "id, full_name, musaned_status, cv_sent_to, cv_sent_date, cv_resent_offices, availability_type, " +
  "cv_approved, medical_status, coc_status, narrative, experience, passport_scan_url, full_photo_url, " +
  "photo_url, status, selected_by, visa_status, ticket_status, created_at";

type Office = AllocOffice & { id: string; locked: boolean };

type Ref = { id: string; name: string };
type Report = {
  assigned: number;
  byOffice: Record<string, number>;
  moved: Array<Ref & { from: string; to: string }>;
  skipped: {
    no_country: Ref[];
    no_office_for_country: Array<Ref & { country: string }>;
    not_ready: Array<Ref & { problems: string[] }>;
    no_other_office: Array<Ref & { office: string }>;
    kept_processing: Array<Ref & { reason: string }>;
    rejected: Array<Ref & { reason: string }>;
  };
  totals: Record<string, number>;
  baseLimit?: number;
  expiryDays?: number;
  officeName?: string;
  note?: string;
};

const emptyReport = (): Report => ({
  assigned: 0,
  byOffice: {},
  moved: [],
  skipped: {
    no_country: [],
    no_office_for_country: [],
    not_ready: [],
    no_other_office: [],
    kept_processing: [],
    rejected: [],
  },
  totals: {},
});

const today = () => new Date().toISOString().split("T")[0];
const ref = (c: Cand): Ref => ({ id: c.id, name: c.full_name ?? "Unnamed" });
const resentList = (c: Cand): string[] =>
  Array.isArray(c.cv_resent_offices) ? (c.cv_resent_offices as string[]) : [];

// ── Context ───────────────────────────────────────────────────────────────────

async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error) throw new Error((error as { message?: string }).message ?? String(error));
    out.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return out;
}

async function loadContext(managerId: string) {
  const [officesRes, countriesRes, profileRes, settingRes, procRows, heldRows] = await Promise.all([
    db
      .from("assignment_offices")
      .select("id, name, country_id, is_locked, rating")
      .eq("manager_id", managerId),
    db.from("assignment_countries").select("id, name").eq("manager_id", managerId),
    db.from("profiles").select("cv_page_requirements").eq("id", managerId).maybeSingle(),
    db.from("system_settings").select("value").eq("key", "cv_expiry_days").maybeSingle(),
    fetchAll<{ selected_by: string | null }>((a, b) =>
      db
        .from("candidates")
        .select("selected_by")
        .eq("manager_id", managerId)
        .eq("status", "processing")
        .not("selected_by", "is", null)
        .range(a, b),
    ),
    fetchAll<{ cv_sent_to: string | null }>((a, b) =>
      db
        .from("candidates")
        .select("cv_sent_to")
        .eq("manager_id", managerId)
        .eq("status", "available")
        .is("selected_by", null)
        .not("cv_sent_to", "is", null)
        .range(a, b),
    ),
  ]);
  if (officesRes.error) throw new Error(officesRes.error.message);
  if (countriesRes.error) throw new Error(countriesRes.error.message);

  const countryName = new Map(
    (countriesRes.data ?? []).map((c) => [c.id as string, c.name as string]),
  );
  const processing: Record<string, number> = {};
  for (const r of procRows)
    if (r.selected_by) processing[r.selected_by] = (processing[r.selected_by] ?? 0) + 1;
  const held: Record<string, number> = {};
  for (const r of heldRows) if (r.cv_sent_to) held[r.cv_sent_to] = (held[r.cv_sent_to] ?? 0) + 1;

  const offices: Office[] = (officesRes.data ?? []).map((o) => ({
    id: o.id as string,
    name: o.name as string,
    country: countryName.get(o.country_id as string) ?? "",
    rating: Number(o.rating ?? 3),
    locked: o.is_locked === true,
    held: held[o.name as string] ?? 0,
    processing: processing[o.name as string] ?? 0,
  }));

  const requirements = (profileRes.data?.cv_page_requirements ?? {}) as Record<string, unknown>;
  const baseLimit =
    parseInt(String(requirements.base_per_office ?? DEFAULT_CV_REQUIREMENTS.base_per_office), 10) ||
    15;
  const expiryDays =
    parseInt(String(requirements.resend_after_days ?? ""), 10) ||
    Number(settingRes.data?.value ?? 6) ||
    6;
  const countries = new Set((countriesRes.data ?? []).map((c) => normCountry(c.name as string)));

  return { offices, requirements, baseLimit, expiryDays, countries };
}

type Ctx = Awaited<ReturnType<typeof loadContext>>;

/** Sort into "can be distributed" vs. the report's skip lists. */
function screen(cands: Cand[], ctx: Ctx, report: Report): Cand[] {
  const activeCountries = new Set(
    ctx.offices.filter((o) => !o.locked).map((o) => normCountry(o.country)),
  );
  const ok: Cand[] = [];
  for (const c of cands) {
    if (isTrainee(c.availability_type)) continue;
    const country = normCountry(c.musaned_status);
    if (!country) {
      report.skipped.no_country.push(ref(c));
      continue;
    }
    if (!activeCountries.has(country)) {
      report.skipped.no_office_for_country.push({ ...ref(c), country: c.musaned_status ?? "" });
      continue;
    }
    const problems = cvReadinessProblems(c, ctx.requirements);
    if (problems.length) {
      report.skipped.not_ready.push({ ...ref(c), problems });
      continue;
    }
    ok.push(c);
  }
  return ok;
}

/** Write assignments; returns how many rows actually changed. */
async function apply(
  managerId: string,
  assignment: Record<string, string>,
  byId: Map<string, Cand>,
  report: Report,
  opts: { trackFrom?: boolean } = {},
) {
  const groups: Record<string, string[]> = {};
  for (const [id, office] of Object.entries(assignment)) (groups[office] ??= []).push(id);

  for (const [office, ids] of Object.entries(groups)) {
    // Moves record the previous office so the CV never goes back there.
    const movers = ids.filter((id) => {
      const c = byId.get(id)!;
      return opts.trackFrom && c.cv_sent_to && c.cv_sent_to !== office;
    });
    const fresh = ids.filter((id) => !movers.includes(id));

    if (fresh.length) {
      const { data, error } = await db
        .from("candidates")
        .update({ cv_sent_to: office, cv_sent_date: today() })
        .in("id", fresh)
        .eq("manager_id", managerId)
        .eq("status", "available")
        .is("selected_by", null)
        .select("id");
      if (error) throw new Error(error.message);
      const n = data?.length ?? 0;
      report.assigned += n;
      if (n) report.byOffice[office] = (report.byOffice[office] ?? 0) + n;
    }

    for (const id of movers) {
      const c = byId.get(id)!;
      const from = c.cv_sent_to!;
      const resent = [...new Set([...resentList(c), from])];
      const { data, error } = await db
        .from("candidates")
        .update({ cv_sent_to: office, cv_sent_date: today(), cv_resent_offices: resent })
        .eq("id", id)
        .eq("manager_id", managerId)
        .eq("status", "available")
        .is("selected_by", null)
        .select("id");
      if (error) throw new Error(error.message);
      if (data?.length) {
        report.assigned += 1;
        report.byOffice[office] = (report.byOffice[office] ?? 0) + 1;
        report.moved.push({ ...ref(c), from, to: office });
      }
    }
  }
}

function toAlloc(c: Cand, extraExclude: string[] = []): AllocCandidate {
  return {
    id: c.id,
    country: c.musaned_status ?? "",
    exclude: [...new Set([...resentList(c), ...extraExclude])],
  };
}

const oldestFirst = (a: Cand, b: Cand) => a.created_at.localeCompare(b.created_at);

async function availableUnselected(managerId: string): Promise<Cand[]> {
  return fetchAll<Cand>((a, b) =>
    db
      .from("candidates")
      .select(CAND_COLS)
      .eq("manager_id", managerId)
      .eq("status", "available")
      .is("selected_by", null)
      .order("created_at", { ascending: true })
      .range(a, b),
  );
}

async function pendingLockOffices(managerId: string): Promise<Set<string>> {
  const { data } = await db
    .from("distribution_jobs")
    .select("payload")
    .eq("manager_id", managerId)
    .eq("kind", "office_locked")
    .in("status", ["pending", "running"]);
  return new Set(
    (data ?? []).map((j) => String((j.payload as Record<string, unknown>)?.office_name ?? "")),
  );
}

// ── Job handlers ──────────────────────────────────────────────────────────────

async function runDistribute(job: Job): Promise<Report> {
  const ctx = await loadContext(job.manager_id);
  const report = emptyReport();
  report.baseLimit = ctx.baseLimit;

  const officeByName = new Map(ctx.offices.map((o) => [o.name, o]));
  const lockWaiting = await pendingLockOffices(job.manager_id);
  const all = await availableUnselected(job.manager_id);

  // Trainees must never hold an office
  const traineeHolders = all
    .filter((c) => isTrainee(c.availability_type) && c.cv_sent_to)
    .map((c) => c.id);
  if (traineeHolders.length) {
    await db
      .from("candidates")
      .update({ cv_sent_to: null, cv_sent_date: null })
      .in("id", traineeHolders);
    report.totals.trainees_cleared = traineeHolders.length;
  }

  const toPlace: Cand[] = [];
  const extraExclude = new Map<string, string[]>();
  for (const c of all) {
    if (isTrainee(c.availability_type)) continue;
    if (!c.cv_sent_to) {
      toPlace.push(c);
      continue;
    }
    const holder = officeByName.get(c.cv_sent_to);
    // Held by a locked office whose move is not scheduled (e.g. locked before this feature) → re-place
    if (holder?.locked && !lockWaiting.has(holder.name)) {
      toPlace.push(c);
      extraExclude.set(c.id, [holder.name]);
      holder.held = Math.max(0, holder.held - 1);
    }
    // Otherwise: an office (or a manually entered agency) holds it — leave it alone.
  }

  const eligible = screen(toPlace, ctx, report).sort(oldestFirst);
  const activeOffices = ctx.offices.filter((o) => !o.locked);
  const { assignment, unplaced } = allocate(
    eligible.map((c) => toAlloc(c, extraExclude.get(c.id))),
    activeOffices,
    ctx.baseLimit,
  );

  const byId = new Map(eligible.map((c) => [c.id, c]));
  await apply(job.manager_id, assignment, byId, report, { trackFrom: true });
  for (const id of unplaced) {
    const c = byId.get(id)!;
    report.skipped.no_other_office.push({ ...ref(c), office: c.cv_sent_to ?? "" });
  }
  report.totals.eligible = eligible.length;
  return report;
}

async function runExpiry(job: Job): Promise<Report> {
  const ctx = await loadContext(job.manager_id);
  const report = emptyReport();
  report.expiryDays = ctx.expiryDays;
  report.baseLimit = ctx.baseLimit;

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - ctx.expiryDays);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const officeNames = new Set(ctx.offices.map((o) => o.name));

  const expired = (
    await fetchAll<Cand>((a, b) =>
      db
        .from("candidates")
        .select(CAND_COLS)
        .eq("manager_id", job.manager_id)
        .eq("status", "available")
        .is("selected_by", null)
        .not("cv_sent_to", "is", null)
        .lte("cv_sent_date", cutoffStr)
        .order("cv_sent_date", { ascending: true })
        .range(a, b),
    )
  ).filter((c) => officeNames.has(c.cv_sent_to!));
  report.totals.expired = expired.length;
  if (!expired.length) return report;

  // Expired CVs free up their current slot
  for (const c of expired) {
    const o = ctx.offices.find((x) => x.name === c.cv_sent_to);
    if (o) o.held = Math.max(0, o.held - 1);
  }

  const notOk = new Set<string>();
  const ok = screen(expired, ctx, report);
  for (const c of expired) if (!ok.includes(c)) notOk.add(c.id);
  // No longer qualifies (trainee / no country / not ready) → take it back from the office
  if (notOk.size) {
    for (const c of expired.filter((x) => notOk.has(x.id))) {
      await db
        .from("candidates")
        .update({
          cv_sent_to: null,
          cv_sent_date: null,
          cv_resent_offices: [...new Set([...resentList(c), c.cv_sent_to!])],
        })
        .eq("id", c.id);
    }
    report.totals.returned_not_qualified = notOk.size;
  }

  const activeOffices = ctx.offices.filter((o) => !o.locked);
  const { assignment, unplaced } = allocate(
    ok.map((c) => toAlloc(c, [c.cv_sent_to!])),
    activeOffices,
    ctx.baseLimit,
  );
  const byId = new Map(ok.map((c) => [c.id, c]));
  await apply(job.manager_id, assignment, byId, report, { trackFrom: true });
  // Every office in the country already had it: start a new round — the current office
  // keeps it for another full window and the "already sent" history is cleared.
  if (unplaced.length) {
    await db
      .from("candidates")
      .update({ cv_sent_date: today(), cv_resent_offices: [] })
      .in("id", unplaced)
      .eq("manager_id", job.manager_id);
  }
  for (const id of unplaced) {
    const c = byId.get(id)!;
    report.skipped.no_other_office.push({ ...ref(c), office: c.cv_sent_to ?? "" });
  }
  if (unplaced.length)
    report.note = "CVs every office already had stay where they are for a new round.";
  return report;
}

async function runOfficeLocked(job: Job): Promise<Report> {
  const report = emptyReport();
  const officeId = String(job.payload.office_id ?? "");
  const { data: office } = await db
    .from("assignment_offices")
    .select("id, name, is_locked")
    .eq("id", officeId)
    .eq("manager_id", job.manager_id)
    .maybeSingle();
  report.officeName = office?.name ?? String(job.payload.office_name ?? "");
  if (!office) {
    report.note = "Office no longer exists";
    return report;
  }
  if (!office.is_locked) {
    report.note = "Office was unlocked before the move ran — nothing moved";
    return report;
  }

  const ctx = await loadContext(job.manager_id);
  report.baseLimit = ctx.baseLimit;
  const lockedOffice = ctx.offices.find((o) => o.id === officeId)!;

  // 1) Processing candidates selected by this office (only when the manager's switch is on)
  const resetIds: string[] = [];
  if (job.payload.move_processing === true) {
    const proc = await fetchAll<Cand>((a, b) =>
      db
        .from("candidates")
        .select(CAND_COLS)
        .eq("manager_id", job.manager_id)
        .eq("status", "processing")
        .eq("selected_by", office.name)
        .range(a, b),
    );
    for (const c of proc) {
      if (isPastPointOfNoReturn(c)) {
        report.skipped.kept_processing.push({
          ...ref(c),
          reason: c.ticket_status === "Booked" ? "Ticket booked" : `Visa ${c.visa_status}`,
        });
        continue;
      }
      resetIds.push(c.id);
    }
    if (resetIds.length) {
      const { error } = await db
        .from("candidates")
        .update({ ...EMPLOYER_RESET_PATCH, cv_sent_to: null, cv_sent_date: null })
        .in("id", resetIds)
        .eq("manager_id", job.manager_id)
        .eq("status", "processing");
      if (error) throw new Error(error.message);
      // Remember the office so they are never sent back to it
      const { data: rows } = await db
        .from("candidates")
        .select("id, cv_resent_offices")
        .in("id", resetIds);
      for (const r of rows ?? []) {
        const prev = Array.isArray(r.cv_resent_offices) ? (r.cv_resent_offices as string[]) : [];
        await db
          .from("candidates")
          .update({ cv_resent_offices: [...new Set([...prev, office.name])] })
          .eq("id", r.id);
      }
      report.totals.processing_returned = resetIds.length;
    }
  }

  // 2) Available CVs held by the locked office + the processing ones just returned
  const held = await fetchAll<Cand>((a, b) =>
    db
      .from("candidates")
      .select(CAND_COLS)
      .eq("manager_id", job.manager_id)
      .eq("status", "available")
      .is("selected_by", null)
      .eq("cv_sent_to", office.name)
      .range(a, b),
  );
  const returned = resetIds.length
    ? (((await db.from("candidates").select(CAND_COLS).in("id", resetIds).eq("status", "available"))
        .data ?? []) as Cand[])
    : [];
  const pool = [...held, ...returned.filter((r) => !held.some((h) => h.id === r.id))].sort(
    oldestFirst,
  );
  report.totals.to_move = pool.length;
  lockedOffice.held = 0;

  const ok = screen(pool, ctx, report);
  // Anything that cannot be re-placed must still leave the locked office
  const leftover = pool
    .filter((c) => !ok.includes(c) && c.cv_sent_to === office.name)
    .map((c) => c.id);
  if (leftover.length) {
    await db.from("candidates").update({ cv_sent_to: null, cv_sent_date: null }).in("id", leftover);
  }

  const activeOffices = ctx.offices.filter((o) => !o.locked);
  const { assignment, unplaced } = allocate(
    ok.map((c) => toAlloc(c, [office.name])),
    activeOffices,
    ctx.baseLimit,
  );
  const byId = new Map(ok.map((c) => [c.id, c]));
  await apply(job.manager_id, assignment, byId, report, { trackFrom: true });
  const stuck = unplaced.filter((id) => byId.get(id)!.cv_sent_to === office.name);
  if (stuck.length)
    await db.from("candidates").update({ cv_sent_to: null, cv_sent_date: null }).in("id", stuck);
  for (const id of unplaced)
    report.skipped.no_other_office.push({ ...ref(byId.get(id)!), office: office.name });
  return report;
}

async function runManualSend(job: Job): Promise<Report> {
  const report = emptyReport();
  const officeId = String(job.payload.office_id ?? "");
  const ids = Array.isArray(job.payload.candidate_ids)
    ? (job.payload.candidate_ids as string[])
    : [];
  const ctx = await loadContext(job.manager_id);
  const office = ctx.offices.find((o) => o.id === officeId);
  if (!office) throw new Error("Office not found");
  if (office.locked) throw new Error(`${office.name} is locked`);
  report.officeName = office.name;

  const { data, error } = await db
    .from("candidates")
    .select(CAND_COLS)
    .eq("manager_id", job.manager_id)
    .in("id", ids);
  if (error) throw new Error(error.message);
  const toSend: Cand[] = [];
  for (const c of (data ?? []) as Cand[]) {
    const reject = (reason: string) => report.skipped.rejected.push({ ...ref(c), reason });
    if (c.status !== "available" || c.selected_by) {
      reject("Not available");
      continue;
    }
    if (isTrainee(c.availability_type)) {
      reject("In training");
      continue;
    }
    if (!normCountry(c.musaned_status)) {
      reject("No country");
      continue;
    }
    if (normCountry(c.musaned_status) !== normCountry(office.country)) {
      reject(`Country is ${c.musaned_status}, office is in ${office.country}`);
      continue;
    }
    if (c.cv_sent_to === office.name) {
      reject("Already at this office");
      continue;
    }
    if (c.cv_sent_to) {
      reject(`Already sent to ${c.cv_sent_to}`);
      continue;
    }
    const problems = cvReadinessProblems(c, ctx.requirements);
    if (problems.length) {
      reject(problems.join(", "));
      continue;
    }
    toSend.push(c);
  }
  const assignment = Object.fromEntries(toSend.map((c) => [c.id, office.name]));
  await apply(job.manager_id, assignment, new Map(toSend.map((c) => [c.id, c])), report);
  return report;
}

// ── Reporting ─────────────────────────────────────────────────────────────────

function capLists(r: Report): Report {
  const s = r.skipped;
  r.totals = {
    ...r.totals,
    no_country: s.no_country.length,
    no_office_for_country: s.no_office_for_country.length,
    not_ready: s.not_ready.length,
    no_other_office: s.no_other_office.length,
    kept_processing: s.kept_processing.length,
    rejected: s.rejected.length,
    moved: r.moved.length,
  };
  for (const k of Object.keys(s) as (keyof Report["skipped"])[])
    s[k] = s[k].slice(0, REPORT_LIST_CAP) as never;
  r.moved = r.moved.slice(0, REPORT_LIST_CAP);
  return r;
}

function summarize(job: Job, r: Report): { title: string; body: string } | null {
  const t = r.totals;
  const skippedCountry = (t.no_country ?? 0) + (t.no_office_for_country ?? 0);
  const parts: string[] = [];
  const fresh = r.assigned - (t.moved ?? 0);
  if (fresh > 0) parts.push(`${fresh} sent`);
  if (t.moved) parts.push(`${t.moved} moved to another office`);
  if (t.processing_returned) parts.push(`${t.processing_returned} processing returned`);
  if (skippedCountry) parts.push(`${skippedCountry} need a country/office`);
  if (t.no_other_office) parts.push(`${t.no_other_office} had no other office`);
  if (t.kept_processing) parts.push(`${t.kept_processing} kept (visa/ticket)`);
  if (t.rejected) parts.push(`${t.rejected} rejected`);

  const titles: Record<Job["kind"], string> = {
    distribute:
      job.trigger === "scheduled" ? "Nightly CV distribution" : "CV distribution finished",
    expiry: `CVs moved after ${r.expiryDays ?? 6} days without response`,
    office_locked: `Locked office ${r.officeName ?? ""}: CVs moved`,
    manual_send: `Manual send to ${r.officeName ?? "office"}`,
  };
  // Scheduled runs that changed nothing and found nothing to report stay quiet
  if (job.trigger !== "manual" && parts.length === 0) return null;
  return {
    title: titles[job.kind],
    body: parts.length ? parts.join(" · ") : "Nothing to distribute",
  };
}

async function notify(job: Job, r: Report) {
  const s = summarize(job, r);
  if (!s) return;
  await db.from("notifications").insert({
    recipient_id: job.manager_id,
    type: "cv_distribution",
    title: s.title,
    body: s.body,
    reference_id: job.id,
    read: false,
    status: "info",
  });
}

// ── Queue loop ────────────────────────────────────────────────────────────────

const HANDLERS: Record<Job["kind"], (j: Job) => Promise<Report>> = {
  distribute: runDistribute,
  expiry: runExpiry,
  office_locked: runOfficeLocked,
  manual_send: runManualSend,
};

async function drain() {
  const started = Date.now();
  while (Date.now() - started < TIME_BUDGET_MS) {
    const { data, error } = await db.rpc("claim_distribution_job");
    if (error) {
      console.error("claim failed", error.message);
      return;
    }
    const job = (Array.isArray(data) ? data[0] : data) as Job | undefined;
    if (!job) return;
    try {
      const report = capLists(await HANDLERS[job.kind](job));
      await db
        .from("distribution_jobs")
        .update({ status: "done", result: report, finished_at: new Date().toISOString() })
        .eq("id", job.id);
      await notify(job, report);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`job ${job.id} (${job.kind}) failed:`, message);
      await db
        .from("distribution_jobs")
        .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
        .eq("id", job.id);
    }
  }
}

Deno.serve((req) => {
  if (!WORKER_SECRET || req.headers.get("x-worker-secret") !== WORKER_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  const work = drain().catch((e) => console.error("drain crashed", e));
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  return new Response(JSON.stringify({ accepted: true }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
});
