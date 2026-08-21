import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const StatusEnum = z.enum(["available", "processing", "arrived", "canceled", "returned"]);

const CandidateInput = z.object({
  full_name: z.string().min(1).max(200),
  first_name: z.string().max(100).optional().nullable(),
  last_name: z.string().max(100).optional().nullable(),
  serial_number: z.string().max(80).optional().nullable(),
  candidate_code: z.string().max(80).optional().nullable(),
  passport_number: z.string().max(80).optional().nullable(),
  labour_id: z.string().max(80).optional().nullable(),
  dob: z.string().optional().nullable(),
  occupation: z.string().max(120).optional().nullable(),
  country: z.string().max(120).optional().nullable(),
  age: z.number().int().min(0).max(120).optional().nullable(),
  gender: z.string().max(40).optional().nullable(),
  religion: z.string().max(80).optional().nullable(),
  birth_place: z.string().max(120).optional().nullable(),
  living_town: z.string().max(120).optional().nullable(),
  marital_status: z.string().max(40).optional().nullable(),
  children: z.number().int().min(0).max(30).optional().nullable(),
  education: z.string().max(120).optional().nullable(),
  passport_issue_date: z.string().optional().nullable(),
  passport_expiry_date: z.string().optional().nullable(),
  place_of_issue: z.string().max(120).optional().nullable(),
  spoken_languages: z.string().max(200).optional().nullable(),
  english_level: z.string().max(40).optional().nullable(),
  arabic_level: z.string().max(40).optional().nullable(),
  experience: z.string().max(120).optional().nullable(),
  experience_country: z.string().max(120).optional().nullable(),
  experience_years: z.string().max(40).optional().nullable(),
  weight: z.number().optional().nullable(),
  height: z.number().optional().nullable(),
  passport_status: z.string().max(80).optional().nullable(),
  medical_status: z.string().max(80).optional().nullable(),
  coc_status: z.string().max(80).optional().nullable(),
  musaned_status: z.string().max(80).optional().nullable(),
  office: z.string().max(80).optional().nullable(),
  selected_by: z.string().max(200).optional().nullable(),
  narrative: z.string().max(200).optional().nullable(),
  narrative_phone: z.string().max(80).optional().nullable(),
  skills: z.string().max(500).optional().nullable(),
  remark: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  availability_type: z.string().max(40).optional().nullable(),
  status: StatusEnum.default("available"),
  contract_date: z.string().optional().nullable(),
  medical_date: z.string().optional().nullable(),
  tasheer_status: z.string().max(80).optional().nullable(),
  tasheer_date: z.string().optional().nullable(),
  wokala_status: z.string().max(80).optional().nullable(),
  embassy_date: z.string().optional().nullable(),
  visa_status: z.string().max(80).optional().nullable(),
  insurance_status: z.string().max(80).optional().nullable(),
  lmis_status: z.string().max(80).optional().nullable(),
  ticket_status: z.string().max(80).optional().nullable(),
  ticket_date: z.string().optional().nullable(),
  arrival_city: z.string().max(80).optional().nullable(),
  processing_notes: z.string().max(2000).optional().nullable(),
  emergency_contact: z.string().max(200).optional().nullable(),
  photo_url: z.preprocess((v) => (v === "" ? null : v), z.string().url().optional().nullable()),
  full_photo_url: z.preprocess((v) => (v === "" ? null : v), z.string().url().optional().nullable()),
  passport_scan_url: z.preprocess((v) => (v === "" ? null : v), z.string().url().optional().nullable()),
  video_url: z.preprocess((v) => (v === "" ? null : v), z.string().url().optional().nullable()),
});

const InlineFieldSchema = z.object({
  id: z.string().uuid(),
  field: z.enum([
    "notes", "narrative", "occupation", "living_town", "selected_by",
    "medical_status", "status", "office", "passport_status",
    "musaned_status", "coc_status",
    // Processing module
    "passport_number", "labour_id",
    "narrative_phone", "contract_date", "medical_date", "medical_days",
    "tasheer_status", "tasheer_date", "wokala_status", "embassy_date",
    "visa_status", "insurance_status", "unfilled_lmis", "lmis_status",
    "ticket_status", "ticket_date", "arrival_city", "emergency_contact",
    "processing_notes", "remark",
    "destination_country", "cv_sent_to",
    "passport_accepted",
    "coc_agency_name", "coc_agency_phone", "coc_booked_date",
    "insurance_date",
    "availability_type",
    "lmis_insu_url", "lmis_coc_url", "lmis_id_url", "lmis_id_relative_url",
    "video_url",
    "delete_reason",
    "ticket_pdf_url",
    "visa_pdf_url",
    "qr_url",
  ]),
  value: z.string().nullable(),
});

function normalizeReligion(value: string | null | undefined): string | null | undefined {
  if (!value) return value;
  const r = value.toLowerCase().replace(/[-\s]+/g, " ").trim();
  if (r === "muslim" || r === "islam" || r === "moslem") return "Muslim";
  if (r === "non muslim" || r === "nonmuslim" || r === "christian" || r === "christianity" || r === "hindu" || r === "buddhist") return "Non-muslim";
  return value;
}

async function resolveChangedBy(userId: string): Promise<{ name: string; email: string | null }> {
  // All three run in parallel — staff lookup now hits idx_staff_user_id
  const [{ data: staffRow }, { data: profile }, { data: { user } }] = await Promise.all([
    supabaseAdmin.from("staff").select("name").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(userId),
  ]);
  const name = staffRow?.name ?? profile?.full_name ?? "Unknown";
  const email = user?.email ?? null;
  return { name, email };
}

async function resolveCreatedByName(userId: string): Promise<string | null> {
  // Staff and profile checks run in parallel
  const [{ data: staffRow }, { data: profile }] = await Promise.all([
    supabaseAdmin.from("staff").select("name").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
  ]);
  const name = staffRow?.name ?? profile?.full_name ?? null;
  return name ? name.trim().split(/\s+/)[0] : null;
}

const UNTRACKED_FIELDS = new Set([
  "lmis_insu_url", "lmis_coc_url", "lmis_id_url", "lmis_id_relative_url", "video_url",
  "photo_url", "full_photo_url", "passport_scan_url", "medical_days", "ticket_pdf_url", "visa_pdf_url", "qr_url",
]);

async function resolveManagerId(userId: string): Promise<string> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role, manager_id")
    .eq("user_id", userId);
  const mgr = roles?.find((r) => r.role === "manager");
  if (mgr) return userId;
  const staff = roles?.find((r) => r.role === "staff");
  if (staff?.manager_id) return staff.manager_id;
  throw new Response("No manager scope", { status: 403 });
}

export const nextCandidateCode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const managerId = await resolveManagerId(context.userId);
    const { data, error } = await (supabaseAdmin as any).rpc("next_candidate_code", { p_manager_id: managerId });
    if (error) throw new Error(error.message);
    return { code: data as string };
  });

export const upsertCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid().optional(), data: CandidateInput }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);

    // Normalize religion to canonical 'Muslim' / 'Non-muslim' before saving
    if (data.data.religion !== undefined) {
      (data.data as Record<string, unknown>).religion = normalizeReligion(data.data.religion);
    }

    // Auto-derive cv_sent_to from musaned_status (Country)
    const today = new Date().toISOString().split("T")[0];
    const autoCountryPatch = (payload: typeof data.data): Record<string, unknown> => {
      if (payload.musaned_status) {
        return { ...payload, cv_sent_to: payload.musaned_status, cv_sent_date: today };
      }
      return { ...payload, cv_sent_to: null, cv_sent_date: null };
    };

    if (data.id) {
      // Fetch existing values before update so we can log what changed
      const { data: existing } = await (supabaseAdmin.from("candidates") as any)
        .select("*")
        .eq("id", data.id)
        .eq("manager_id", managerId)
        .maybeSingle();

      const patched = autoCountryPatch(data.data);
      const { error } = await (supabaseAdmin.from("candidates") as any)
        .update(patched)
        .eq("id", data.id)
        .eq("manager_id", managerId);
      if (error) {
        if (error.code === "23505" && error.message.includes("candidate_code")) {
          throw new Error(`Candidate code "${patched.candidate_code}" is already used by another candidate — please choose a different code.`);
        }
        throw new Error(error.message);
      }

      if (existing) {
        const { name: changedByName, email: changedByEmail } = await resolveChangedBy(context.userId);
        const logRows: Record<string, unknown>[] = [];
        for (const [field, newVal] of Object.entries(patched)) {
          if (UNTRACKED_FIELDS.has(field)) continue;
          const oldRaw = existing[field];
          const oldStr = oldRaw == null ? null : String(oldRaw);
          const newStr = newVal == null ? null : String(newVal);
          if (oldStr === newStr) continue;
          logRows.push({
            candidate_id: data.id,
            field,
            old_value: oldStr,
            new_value: newStr,
            changed_by_user_id: context.userId,
            changed_by_name: changedByName,
            changed_by_email: changedByEmail,
          });
        }
        if (logRows.length > 0) {
          await supabaseAdmin.from("candidate_field_log").insert(logRows as never);
        }
      }

      return { ok: true, id: data.id };
    }
    // Resolve name, next/validate code, duplicate checks, and staff ID — all in parallel
    const passportTrim = data.data.passport_number?.trim();
    const manualCode   = data.data.candidate_code?.trim() || null;
    const [createdByName, codeResult, passportDup, codeDup, staffRow] = await Promise.all([
      resolveCreatedByName(context.userId),
      manualCode
        ? Promise.resolve({ data: manualCode, error: null })
        : (supabaseAdmin as any).rpc("next_candidate_code", { p_manager_id: managerId }),
      passportTrim
        ? (supabaseAdmin.from("candidates") as any)
            .select("id, full_name, candidate_code")
            .eq("manager_id", managerId)
            .ilike("passport_number", passportTrim)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // Check the manually-entered code isn't already taken
      manualCode
        ? (supabaseAdmin.from("candidates") as any)
            .select("id, full_name")
            .eq("manager_id", managerId)
            .eq("candidate_code", manualCode)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // Look up staff record so candidate is assigned to the registering staff member
      supabaseAdmin.from("staff").select("id").eq("user_id", context.userId).maybeSingle(),
    ]);

    if (codeResult.error) throw new Error(codeResult.error.message);
    const candidateCode = codeResult.data as string;

    if (passportDup.data) {
      const label = passportDup.data.candidate_code ?? passportDup.data.full_name ?? "existing record";
      throw new Error(`Duplicate passport number — already registered as ${label}`);
    }
    if (codeDup.data) {
      const label = codeDup.data.full_name ?? "another candidate";
      throw new Error(`Candidate code "${candidateCode}" is already used by ${label}. Please choose a different code.`);
    }

    const assignedStaffId = (staffRow.data as { id: string } | null)?.id ?? null;

    const { data: row, error } = await supabaseAdmin
      .from("candidates")
      .insert({
        ...autoCountryPatch(data.data),
        candidate_code: candidateCode,
        manager_id: managerId,
        created_by_user_id: context.userId,
        created_by_name: createdByName,
        assigned_staff_id: assignedStaffId,
      } as never)
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505" && error.message.includes("candidate_code")) {
        throw new Error(`Candidate code "${candidateCode}" is already taken — please use a different code.`);
      }
      throw new Error(error.message);
    }
    return { ok: true, id: row.id };
  });

export const updateCandidateField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InlineFieldSchema.parse(input))
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const raw = data.value === "" ? null : data.value;
    // medical_days is stored as integer; passport_accepted is stored as boolean
    const coerced =
      data.field === "medical_days" && raw !== null ? Number(raw) :
      data.field === "passport_accepted" && raw !== null ? raw === "true" :
      raw;
    const payload: Record<string, unknown> = { [data.field]: coerced };

    const FIELD_TS_MAP: Record<string, string> = {
      visa_status: "visa_updated_at",
      ticket_status: "ticket_updated_at",
      ticket_date: "ticket_date_updated_at",
      arrival_city: "arrival_city_updated_at",
    };
    if (FIELD_TS_MAP[data.field]) {
      payload[FIELD_TS_MAP[data.field]] = raw !== null ? new Date().toISOString() : null;
    }

    if (data.field === "cv_sent_to") {
      payload.cv_sent_date = raw ? new Date().toISOString().split("T")[0] : null;
    }

    // Clear ticket_date whenever ticket_status changes to anything other than "Booked"
    if (data.field === "ticket_status" && raw !== "Booked") {
      payload.ticket_date = null;
    }

    // Clear coc_booked_date whenever coc_status changes to anything other than "Booked"
    if (data.field === "coc_status" && raw !== "Booked") {
      payload.coc_booked_date = null;
    }

    const shouldTrack = !UNTRACKED_FIELDS.has(data.field);

    // Single pre-flight read replaces 2-3 separate conditional fetches.
    // Includes fields needed for all business-logic checks + old-value tracking.
    const needsPreflight =
      shouldTrack ||
      (data.field === "tasheer_status" && raw !== "Booked" && raw !== "Done") ||
      (data.field === "selected_by" && !!raw) ||
      (data.field === "availability_type" && raw === "Private");

    const preflightCols = new Set(["tasheer_date", "status", "contract_date", "selected_by"]);
    if (shouldTrack) preflightCols.add(data.field);

    const cur: Record<string, unknown> | null = needsPreflight
      ? await (supabaseAdmin.from("candidates") as any)
          .select([...preflightCols].join(","))
          .eq("id", data.id)
          .eq("manager_id", managerId)
          .maybeSingle()
          .then((r: any) => r.data)
      : null;

    // Clear tasheer_date only when tasheer_status is explicitly cleared (set to null/empty).
    // Preserve it for all named values: "No", "Booked", "Done", "Ready", etc.
    if (data.field === "tasheer_status" && !raw) {
      payload.tasheer_date = null;
    }

    // Auto-assign cv_sent_to when the Country (musaned_status) field is set
    if (data.field === "musaned_status" && raw) {
      payload.cv_sent_to = raw;
      payload.cv_sent_date = new Date().toISOString().split("T")[0];
    }
    if (data.field === "musaned_status" && !raw) {
      payload.cv_sent_to = null;
      payload.cv_sent_date = null;
    }

    // When selected_by is set on an available candidate, auto-advance to processing
    if (data.field === "selected_by" && raw && cur) {
      if (cur.status === "available") payload.status = "processing";
      if (!cur.contract_date) payload.contract_date = new Date().toISOString().split("T")[0];
    }

    // When availability_type is set to "Private" and selected_by is filled, auto-advance to processing
    if (data.field === "availability_type" && raw === "Private" && cur) {
      if (cur.status === "available" && cur.selected_by) {
        payload.status = "processing";
        if (!cur.contract_date) payload.contract_date = new Date().toISOString().split("T")[0];
      }
    }

    const oldValue: string | null =
      shouldTrack && cur != null
        ? cur[data.field] == null ? null : String(cur[data.field])
        : null;

    // Parallelize the DB write and the changedBy lookup — they don't depend on each other
    const [updateResult, changedBy] = await Promise.all([
      (supabaseAdmin.from("candidates") as any)
        .update(payload)
        .eq("id", data.id)
        .eq("manager_id", managerId),
      shouldTrack ? resolveChangedBy(context.userId) : Promise.resolve(null),
    ]);
    if (updateResult.error) throw new Error(updateResult.error.message);

    if (shouldTrack && changedBy) {
      await supabaseAdmin.from("candidate_field_log").insert({
        candidate_id: data.id,
        field: data.field,
        old_value: oldValue,
        new_value: raw,
        changed_by_user_id: context.userId,
        changed_by_name: changedBy.name,
        changed_by_email: changedBy.email,
      });
    }

    return { ok: true };
  });
export const deleteCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const { error } = await supabaseAdmin
      .from("candidates")
      .delete()
      .eq("id", data.id)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const IdList = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

export const bulkDeleteCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdList.parse(input))
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const { error, count } = await supabaseAdmin
      .from("candidates")
      .delete({ count: "exact" })
      .in("id", data.ids)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true, count: count ?? 0 };
  });

export const bulkUpdateStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    IdList.extend({ status: StatusEnum }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const { error, count } = await supabaseAdmin
      .from("candidates")
      .update({ status: data.status }, { count: "exact" })
      .in("id", data.ids)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true, count: count ?? 0 };
  });

export const bulkUpdateField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    IdList.extend({
      field: InlineFieldSchema.shape.field,
      value: z.string().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const raw = data.value === "" ? null : data.value;
    const coercedBulk =
      data.field === "passport_accepted" && raw !== null ? raw === "true" : raw;
    const patch: Record<string, unknown> = { [data.field]: coercedBulk };
    if (data.field === "cv_sent_to") {
      patch.cv_sent_date = raw ? new Date().toISOString().split("T")[0] : null;
      if (!raw) patch.status = "canceled";
    }
    const { error, count } = await supabaseAdmin
      .from("candidates")
      .update(patch as never, { count: "exact" })
      .in("id", data.ids)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true, count: count ?? 0 };
  });

export const bulkImportCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rows: z.array(CandidateInput).min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const createdByName = await resolveCreatedByName(context.userId);

    // Rows that already carry a code vs rows that need one generated
    const withCode    = data.rows.filter((r) => !!r.candidate_code?.trim());
    const withoutCode = data.rows.filter((r) => !r.candidate_code?.trim());

    // Reject imports that contain their own internal duplicates
    const providedCodes = withCode.map((r) => r.candidate_code!.trim().toUpperCase());
    if (new Set(providedCodes).size !== providedCodes.length) {
      throw new Error("Import file contains duplicate candidate codes — please fix and re-upload.");
    }

    // Batch-generate codes for rows that need them (single round-trip)
    let generatedCodes: string[] = [];
    if (withoutCode.length > 0) {
      const { data: codes, error: batchErr } = await (supabaseAdmin as any)
        .rpc("next_candidate_codes_batch", { p_manager_id: managerId, p_count: withoutCode.length });
      if (batchErr) throw new Error(batchErr.message);
      generatedCodes = codes as string[];
    }

    let genIdx = 0;
    const rows = data.rows.map((r) => ({
      ...r,
      candidate_code: r.candidate_code?.trim() || generatedCodes[genIdx++],
      religion: normalizeReligion(r.religion),
      manager_id: managerId,
      created_by_user_id: context.userId,
      created_by_name: createdByName,
    }));

    const { error, count } = await supabaseAdmin
      .from("candidates")
      .insert(rows as never[], { count: "exact" });
    if (error) {
      if (error.code === "23505" && error.message.includes("candidate_code")) {
        throw new Error("One or more candidate codes in the import already exist — please remove duplicates and re-upload.");
      }
      throw new Error(error.message);
    }
    return { ok: true, count: count ?? rows.length };
  });

export const bulkAssignStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    IdList.extend({ staff_id: z.string().uuid().nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    if (data.staff_id) {
      const { data: staffRow, error: sErr } = await supabaseAdmin
        .from("staff")
        .select("id")
        .eq("id", data.staff_id)
        .eq("manager_id", managerId)
        .maybeSingle();
      if (sErr) throw new Error(sErr.message);
      if (!staffRow) throw new Error("Staff not in your team");
    }
    const { error, count } = await supabaseAdmin
      .from("candidates")
      .update({ assigned_staff_id: data.staff_id }, { count: "exact" })
      .in("id", data.ids)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true, count: count ?? 0 };
  });

export const logFlightReadiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    IdList.extend({ answer: z.enum(["Ready", "Not ready"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const { data: owned } = await supabaseAdmin
      .from("candidates")
      .select("id")
      .in("id", data.ids)
      .eq("manager_id", managerId);
    const ownedIds = (owned ?? []).map((r) => r.id);
    if (ownedIds.length === 0) return { ok: true };
    const { name: changedByName, email: changedByEmail } = await resolveChangedBy(context.userId);
    const rows = ownedIds.map((id) => ({
      candidate_id: id,
      field: "flight_readiness",
      old_value: null,
      new_value: data.answer,
      changed_by_user_id: context.userId,
      changed_by_name: changedByName,
      changed_by_email: changedByEmail,
    }));
    await supabaseAdmin.from("candidate_field_log").insert(rows as never[]);
    return { ok: true };
  });

// Fetches ALL candidates for the manager by paginating through Supabase's
// default 1000-row PostgREST cap using .range() so no candidate is silently dropped.
export const getCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const managerId = await resolveManagerId(context.userId);
    const PAGE = 1000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all: any[] = [];
    let from = 0;
    for (let page = 0; page < 50; page++) { // safety cap: 50 000 candidates max
      const { data, error } = await (supabaseAdmin.from("candidates") as any)
        .select("*")
        .eq("manager_id", managerId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      all.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return all as any[];
  });

// Fast full-text search across all candidates for a manager.
// Uses pg_trgm GIN indexes added in 20260807130000 for sub-10ms ILIKE on large tables.
export const searchCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ q: z.string().max(100) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const term = data.q.trim();
    if (term.length < 2) return [];
    const managerId = await resolveManagerId(context.userId);
    // Strip characters that would break the PostgREST or() filter string
    const safe = term.replace(/[,()|]/g, " ").trim();
    if (!safe) return [];
    const pattern = `%${safe}%`;
    const { data: rows, error } = await (supabaseAdmin.from("candidates") as any)
      .select("id,full_name,candidate_code,passport_number,labour_id,photo_url,status,occupation,country")
      .eq("manager_id", managerId)
      .or(
        `full_name.ilike.${pattern},` +
        `passport_number.ilike.${pattern},` +
        `candidate_code.ilike.${pattern},` +
        `labour_id.ilike.${pattern}`,
      )
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    return rows as Array<{
      id: string;
      full_name: string | null;
      candidate_code: string | null;
      passport_number: string | null;
      labour_id: string | null;
      photo_url: string | null;
      status: string;
      occupation: string | null;
      country: string | null;
    }>;
  });

const WAFID_NATIONALITY: Array<[string, string]> = [
  ["ethiop", "60"],
  ["philippin", "177"],
  ["filipin", "177"],
  ["sri lanka", "156"],
  ["indonesia", "81"],
  ["bangladesh", "15"],
  ["kenya", "92"],
  ["uganda", "166"],
  ["india", "1"],
  ["nepal", "125"],
  ["ghana", "69"],
];

function wafidNationality(country: string | null): string {
  const lc = (country ?? "").toLowerCase();
  for (const [key, val] of WAFID_NATIONALITY) {
    if (lc.includes(key)) return val;
  }
  return "60"; // fallback Ethiopian
}

export const checkWafidMedical = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ candidateId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);

    const { data: candidate, error } = await supabaseAdmin
      .from("candidates")
      .select("id, passport_number, country, medical_status, manager_id")
      .eq("id", data.candidateId)
      .eq("manager_id", managerId)
      .single();

    if (error || !candidate) throw new Error("Candidate not found");
    if (!candidate.passport_number?.trim()) throw new Error("No passport number on file");

    const passport = candidate.passport_number.trim().toUpperCase();
    const nationality = wafidNationality(candidate.country);

    const WAFID_URL = "https://wafid.com/en/medical-status-search/";
    const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    // Step 1: GET the search page to obtain the CSRF token + session cookie.
    let pageHtml: string;
    let cookieStr: string;
    try {
      const getRes = await fetch(WAFID_URL, {
        headers: {
          "User-Agent": UA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (!getRes.ok) {
        return { status: null as string | null, date: null as string | null, message: `wafid.com unreachable (HTTP ${getRes.status})` };
      }
      pageHtml = await getRes.text();
      // getSetCookie() returns each Set-Cookie header separately (Node 18+ / Bun).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawCookies: string[] = typeof (getRes.headers as any).getSetCookie === "function"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (getRes.headers as any).getSetCookie()
        : [getRes.headers.get("set-cookie") ?? ""];
      cookieStr = rawCookies.map(h => h.split(";")[0].trim()).filter(Boolean).join("; ");
    } catch (e) {
      return { status: null as string | null, date: null as string | null, message: `Network error reaching wafid.com: ${e}` };
    }

    const csrfMatch = pageHtml.match(/name=["']csrfmiddlewaretoken["'][^>]*value=["']([^"']+)["']|value=["']([^"']+)["'][^>]*name=["']csrfmiddlewaretoken["']/);
    const csrf = csrfMatch?.[1] ?? csrfMatch?.[2];
    if (!csrf) {
      return { status: null as string | null, date: null as string | null, message: "Could not read CSRF token from wafid.com" };
    }

    // Step 2: Solve the reCAPTCHA v3 via 2captcha so wafid.com accepts the POST.
    const TWOCAPTCHA_KEY = process.env.TWOCAPTCHA_API_KEY;
    if (!TWOCAPTCHA_KEY) {
      return {
        status: null as string | null,
        date: null as string | null,
        message: "TWOCAPTCHA_API_KEY env var not set — required for wafid.com reCAPTCHA",
      };
    }

    const RECAPTCHA_SITE_KEY = "6LflPAwnAAAAAL2wBGi6tSyGUyj-xFvftINOR9xp";

    let recaptchaToken: string | null = null;
    try {
      // Submit task using the 2captcha JSON API
      const submitRes = await fetch("https://api.2captcha.com/createTask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientKey: TWOCAPTCHA_KEY,
          task: {
            type: "RecaptchaV3TaskProxyless",
            websiteURL: WAFID_URL,
            websiteKey: RECAPTCHA_SITE_KEY,
            minScore: 0.1,
            pageAction: "form",
          },
        }),
      });
      const submitData = await submitRes.json() as { errorId: number; errorCode?: string; taskId?: number };
      if (submitData.errorId !== 0) throw new Error(submitData.errorCode ?? "createTask failed");
      const taskId = submitData.taskId!;

      // Poll up to 90 s (2captcha typically resolves in 15-30 s)
      for (let i = 0; i < 18; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const pollRes = await fetch("https://api.2captcha.com/getTaskResult", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientKey: TWOCAPTCHA_KEY, taskId }),
        });
        const pollData = await pollRes.json() as {
          errorId: number; errorCode?: string;
          status: string; solution?: { gRecaptchaResponse: string };
        };
        if (pollData.errorId !== 0) throw new Error(pollData.errorCode ?? "getTaskResult failed");
        if (pollData.status === "ready") { recaptchaToken = pollData.solution!.gRecaptchaResponse; break; }
      }
    } catch (e) {
      return { status: null as string | null, date: null as string | null, message: `reCAPTCHA solve failed: ${e}` };
    }

    if (!recaptchaToken) {
      return { status: null as string | null, date: null as string | null, message: "reCAPTCHA solve timed out" };
    }

    // Step 3: POST the form with the solved reCAPTCHA token.
    const formBody = new URLSearchParams({
      csrfmiddlewaretoken: csrf,
      search_variant: "passport",
      passport,
      nationality,
      captcha: recaptchaToken,
    });

    let resultHtml: string;
    try {
      const postRes = await fetch(WAFID_URL, {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
          "Referer": WAFID_URL,
          "Origin": "https://wafid.com",
          "Cookie": cookieStr,
          "X-CSRFToken": csrf,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        body: formBody.toString(),
      });
      resultHtml = await postRes.text();
    } catch (e) {
      return { status: null as string | null, date: null as string | null, message: `POST to wafid.com failed: ${e}` };
    }

    let status: string | null = null;
    let date: string | null = null;
    let message = "";

    if (resultHtml.includes("medical-status-modal-acceptance") || />\s*fit\s*</i.test(resultHtml)) {
      status = "Fit";
      const dateMatch = resultHtml.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/);
      if (dateMatch) {
        const parts = dateMatch[0].split(/[\/\-]/).map((p: string) => p.padStart(2, "0"));
        date = parts[2].length === 4 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateMatch[0];
      }
    } else if (resultHtml.includes("medical-status-modal-rejection") || />\s*unfit\s*</i.test(resultHtml)) {
      status = "Unfit";
    } else if (/>\s*in[\s-]*progress\s*</i.test(resultHtml) || /class="status"[^>]*>\s*in[\s-]*progress/i.test(resultHtml)) {
      status = "In progress";
    } else if (resultHtml.includes("medical-status-modal-normal") || />\s*retest\s*</i.test(resultHtml)) {
      status = "Retest";
    } else if (/no active appointment found|no[- ]record|not found|invalid passport/i.test(resultHtml)) {
      message = "No record on Wafid";
    } else if (/error verifying recaptcha/i.test(resultHtml)) {
      message = "reCAPTCHA verification failed — please try again";
    } else if (resultHtml.includes("id_passport")) {
      const snippet = resultHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
      message = `Could not determine status. Response: ${snippet}`;
    } else {
      // Surface a snippet so we can see what wafid actually returned
      const snippet = resultHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
      message = `Could not determine status. Response: ${snippet}`;
    }

    if (status && status !== candidate.medical_status) {
      const today = new Date().toISOString().split("T")[0];
      await supabaseAdmin
        .from("candidates")
        .update({ medical_status: status, medical_date: date ?? today })
        .eq("id", data.candidateId);
    }

    return {
      status: status as string | null,
      date: date as string | null,
      message: message || (status ? `${status}${date ? ` · ${date}` : ""}` : "No result"),
    };
  });
