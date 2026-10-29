import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function resolveManagerId(userId: string): Promise<string | null> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role, manager_id")
    .eq("user_id", userId);
  const staffRole = roles?.find((r) => r.role === "staff" && r.manager_id);
  if (staffRole?.manager_id) return staffRole.manager_id as string;
  if (roles?.find((r) => r.role === "manager")) return userId;
  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("manager_id")
    .eq("user_id", userId)
    .maybeSingle();
  return staffRow?.manager_id ?? null;
}

type OfficeMeta = { name: string; countryName: string | null };

async function loadActiveOffices(managerId: string): Promise<OfficeMeta[]> {
  const [{ data: officesRaw }, { data: countriesRaw }] = await Promise.all([
    supabaseAdmin.from("assignment_offices").select("name, country_id, is_locked").eq("manager_id", managerId),
    supabaseAdmin.from("assignment_countries").select("id, name").eq("manager_id", managerId),
  ]);
  const countryMap = new Map((countriesRaw ?? []).map((c) => [c.id, c.name]));
  return (officesRaw ?? [])
    .filter((o) => !(o as any).is_locked)
    .map((o) => ({ name: o.name, countryName: countryMap.get(o.country_id) ?? null }));
}

async function loadProcessingPct(managerId: string): Promise<Record<string, number>> {
  const { data } = await supabaseAdmin
    .from("candidates")
    .select("selected_by")
    .eq("manager_id", managerId)
    .eq("status", "processing")
    .not("selected_by", "is", null);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const k = row.selected_by!;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return {};
  const pct: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) pct[k] = v / total;
  return pct;
}

function runAlgorithm(
  candidates: Array<{ id: string; musaned_status: string | null }>,
  offices: OfficeMeta[],
  processingPct: Record<string, number>,
  basePerOffice: number,
  excludeFor: Record<string, string> = {},
): Record<string, string> {
  if (offices.length === 0 || candidates.length === 0) return {};

  const assignment: Record<string, string> = {};
  const slots: Record<string, number> = Object.fromEntries(offices.map((o) => [o.name, basePerOffice]));
  const remaining = [...candidates];

  const pop = (idx: number) => remaining.splice(idx, 1)[0];

  // Pass 1: country-match + fill to base
  for (const o of offices) {
    if (remaining.length === 0) break;
    const countryMatches = remaining
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => o.countryName && c.musaned_status === o.countryName && excludeFor[c.id] !== o.name)
      .slice(0, slots[o.name]);
    for (const { i } of countryMatches.reverse()) {
      const c = pop(i);
      assignment[c.id] = o.name;
      slots[o.name]--;
    }
  }

  // Pass 2: fill remaining base slots with any unmatched candidates
  for (const o of offices) {
    if (slots[o.name] <= 0 || remaining.length === 0) continue;
    const eligible = remaining
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => excludeFor[c.id] !== o.name)
      .slice(0, slots[o.name]);
    for (const { i } of eligible.reverse()) {
      const c = pop(i);
      assignment[c.id] = o.name;
      slots[o.name]--;
    }
  }

  // Pass 3: overflow distributed by processing %
  if (remaining.length > 0) {
    const sortedByPct = [...offices].sort((a, b) => (processingPct[b.name] ?? 0) - (processingPct[a.name] ?? 0));
    const hasPct = Object.keys(processingPct).length > 0;
    const overflowTotal = remaining.length;
    let leftover = [...remaining];

    if (hasPct) {
      for (let i = 0; i < sortedByPct.length; i++) {
        const o = sortedByPct[i];
        const isLast = i === sortedByPct.length - 1;
        const count = isLast
          ? leftover.length
          : Math.round(overflowTotal * (processingPct[o.name] ?? 0));
        const pool = leftover.filter((c) => excludeFor[c.id] !== o.name).slice(0, count);
        for (const c of pool) {
          assignment[c.id] = o.name;
          leftover = leftover.filter((r) => r.id !== c.id);
        }
      }
    }

    // Round-robin for any still unassigned
    let rrIdx = 0;
    for (const c of leftover) {
      for (let attempt = 0; attempt < sortedByPct.length; attempt++) {
        const o = sortedByPct[(rrIdx + attempt) % sortedByPct.length];
        if (excludeFor[c.id] !== o.name) {
          assignment[c.id] = o.name;
          break;
        }
      }
      rrIdx++;
    }
  }

  // Hard guarantee: every candidate must go to an available office
  for (const c of candidates) {
    if (assignment[c.id]) continue;
    // Try to find any office that isn't excluded for this candidate
    const chosen = offices.find((o) => excludeFor[c.id] !== o.name) ?? offices[0];
    assignment[c.id] = chosen.name;
  }

  return assignment;
}

async function applyAssignment(
  managerId: string,
  assignment: Record<string, string>,
): Promise<number> {
  if (Object.keys(assignment).length === 0) return 0;
  const today = new Date().toISOString().split("T")[0];
  const grouped: Record<string, string[]> = {};
  for (const [id, office] of Object.entries(assignment)) {
    (grouped[office] ??= []).push(id);
  }
  let totalUpdated = 0;
  for (const [office, ids] of Object.entries(grouped)) {
    const { count } = await supabaseAdmin
      .from("candidates")
      .update({ cv_sent_to: office, cv_sent_date: today } as never, { count: "exact" })
      .in("id", ids)
      .eq("manager_id", managerId);
    totalUpdated += count ?? 0;
  }
  return totalUpdated;
}

async function trackResentOffices(
  managerId: string,
  assignment: Record<string, string>,
  oldOffices: Record<string, string | null>,
): Promise<void> {
  const moved = Object.entries(assignment)
    .filter(([id, newOffice]) => { const o = oldOffices[id]; return !!o && o !== newOffice; })
    .map(([id]) => ({ id, oldOffice: oldOffices[id]! }));
  if (moved.length === 0) return;

  const { data: current } = await supabaseAdmin
    .from("candidates")
    .select("id, cv_resent_offices")
    .in("id", moved.map((m) => m.id))
    .eq("manager_id", managerId);

  const resentMap = new Map(
    (current ?? []).map((r) => [r.id, (Array.isArray(r.cv_resent_offices) ? r.cv_resent_offices : []) as string[]]),
  );

  await Promise.all(
    moved.map(({ id, oldOffice }) =>
      supabaseAdmin
        .from("candidates")
        .update({ cv_resent_offices: [...(resentMap.get(id) ?? []), oldOffice] as never })
        .eq("id", id)
        .eq("manager_id", managerId),
    ),
  );
}

// ─── Exported utility (used by assignments.functions.ts on office lock) ──────

export async function redistributeFromLockedOffice(
  managerId: string,
  lockedOfficeName: string,
  basePerOffice: number,
): Promise<number> {
  // loadActiveOffices excludes locked offices, so the just-locked office is already excluded
  const [offices, processingPct] = await Promise.all([
    loadActiveOffices(managerId),
    loadProcessingPct(managerId),
  ]);

  const { data: candidates } = await supabaseAdmin
    .from("candidates")
    .select("id, musaned_status")
    .eq("manager_id", managerId)
    .eq("cv_sent_to", lockedOfficeName)
    .eq("status", "available");

  if (!candidates?.length) return 0;

  if (offices.length === 0) {
    await supabaseAdmin
      .from("candidates")
      .update({ cv_sent_to: null, cv_sent_date: null } as never)
      .in("id", candidates.map((c) => c.id))
      .eq("manager_id", managerId);
    return candidates.length;
  }

  // Exclude the locked office so candidates are never reassigned back to it
  const excludeFor = Object.fromEntries(candidates.map((c) => [c.id, lockedOfficeName]));
  const assignment = runAlgorithm(candidates, offices, processingPct, basePerOffice, excludeFor);

  await applyAssignment(managerId, assignment);
  await trackResentOffices(managerId, assignment, excludeFor);

  return candidates.length;
}

// ─── Server functions ─────────────────────────────────────────────────────────

export const distributeCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const managerId = await resolveManagerId(context.userId);
    if (!managerId) throw new Error("Manager not found");

    // Load manager config
    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("cv_page_requirements")
      .eq("id", managerId)
      .maybeSingle();
    const req = (profileRow?.cv_page_requirements as Record<string, string>) ?? {};
    const basePerOffice = parseInt(req.base_per_office ?? "15", 10) || 15;

    // Load offices and processing %
    const [offices, processingPct] = await Promise.all([
      loadActiveOffices(managerId),
      loadProcessingPct(managerId),
    ]);
    if (offices.length === 0) return { assigned: 0, byOffice: {} };

    // All available candidates — distribution sends everyone, not just CV Ready
    const { data: candidates } = await supabaseAdmin
      .from("candidates")
      .select("id, musaned_status, cv_sent_to")
      .eq("manager_id", managerId)
      .eq("status", "available")
      .is("selected_by", null);
    if (!candidates || candidates.length === 0) return { assigned: 0, byOffice: {} };

    // Capture old offices before nulling
    const oldOffices: Record<string, string | null> = {};
    for (const c of candidates) oldOffices[c.id] = c.cv_sent_to;

    // Clear all qualifying candidates first
    const ids = candidates.map((c) => c.id);
    await supabaseAdmin
      .from("candidates")
      .update({ cv_sent_to: null, cv_sent_date: null } as never)
      .in("id", ids)
      .eq("manager_id", managerId);

    // Also evict any available candidates still sitting at locked offices
    const { data: lockedOfficesRaw } = await supabaseAdmin
      .from("assignment_offices")
      .select("name")
      .eq("manager_id", managerId)
      .eq("is_locked", true);
    const lockedNames = (lockedOfficesRaw ?? []).map((o) => o.name);
    if (lockedNames.length > 0) {
      await supabaseAdmin
        .from("candidates")
        .update({ cv_sent_to: null, cv_sent_date: null } as never)
        .eq("manager_id", managerId)
        .eq("status", "available")
        .in("cv_sent_to", lockedNames);
    }

    // Run algorithm
    const assignment = runAlgorithm(candidates, offices, processingPct, basePerOffice);

    // Save and track history
    const assigned = await applyAssignment(managerId, assignment);
    await trackResentOffices(managerId, assignment, oldOffices);

    // Count per office
    const byOffice: Record<string, number> = {};
    for (const office of Object.values(assignment)) {
      byOffice[office] = (byOffice[office] ?? 0) + 1;
    }

    return { assigned, byOffice };
  });

export const checkAndResendExpiredCvs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const managerId = await resolveManagerId(context.userId);
    if (!managerId) return { redistributed: 0 };

    // Load threshold (days before resend)
    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("cv_days_threshold, cv_page_requirements")
      .eq("id", managerId)
      .maybeSingle();
    const threshold = profileRow?.cv_days_threshold ?? 5;
    const basePerOffice = parseInt(((profileRow?.cv_page_requirements as Record<string, string>) ?? {}).base_per_office ?? "15", 10) || 15;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - threshold);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    // All overdue available candidates — same broad scope as distributeCandidates
    const { data: expiredRaw } = await supabaseAdmin
      .from("candidates")
      .select("id, musaned_status, cv_sent_to")
      .eq("manager_id", managerId)
      .eq("status", "available")
      .is("selected_by", null)
      .not("cv_sent_to", "is", null)
      .lte("cv_sent_date", cutoffStr);

    if (!expiredRaw || expiredRaw.length === 0) return { redistributed: 0 };

    const [offices, processingPct] = await Promise.all([
      loadActiveOffices(managerId),
      loadProcessingPct(managerId),
    ]);
    if (offices.length === 0) return { redistributed: 0 };

    // Build excludeFor: each candidate should avoid their current office
    const excludeFor: Record<string, string> = {};
    for (const c of expiredRaw) {
      if (c.cv_sent_to) excludeFor[c.id] = c.cv_sent_to;
    }

    const assignment = runAlgorithm(
      expiredRaw.map((c) => ({ id: c.id, musaned_status: c.musaned_status })),
      offices,
      processingPct,
      basePerOffice,
      excludeFor,
    );

    const redistributed = await applyAssignment(managerId, assignment);
    await trackResentOffices(managerId, assignment, excludeFor);
    return { redistributed };
  });

export const autoDistributeNewCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ candidateId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const managerId = await resolveManagerId(context.userId);
    if (!managerId) return { sentTo: null };

    // Load candidate (include photo/scan fields for CV Ready check)
    const { data: candidate } = await supabaseAdmin
      .from("candidates")
      .select("id, musaned_status, status, medical_status, coc_status, narrative, experience, selected_by, passport_scan_url, full_photo_url, photo_url")
      .eq("id", data.candidateId)
      .eq("manager_id", managerId)
      .maybeSingle();

    if (!candidate || candidate.status !== "available" || candidate.selected_by) return { sentTo: null };

    // Load manager requirements
    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("cv_page_requirements")
      .eq("id", managerId)
      .maybeSingle();
    const req = (profileRow?.cv_page_requirements as Record<string, string>) ?? {};
    const basePerOffice = parseInt(req.base_per_office ?? "15", 10) || 15;

    // Check candidate meets all CV Ready requirements
    if (req.medical    && req.medical    !== "all" && candidate.medical_status !== req.medical) return { sentTo: null };
    if (req.coc        && req.coc        !== "all" && candidate.coc_status     !== req.coc) return { sentTo: null };
    if (req.narrative  && req.narrative  !== "all" && candidate.narrative      !== req.narrative) return { sentTo: null };
    if (req.experience && req.experience !== "all" && candidate.experience     !== req.experience) return { sentTo: null };
    if (req.passport_scan   === "Yes" && !candidate.passport_scan_url)  return { sentTo: null };
    if (req.full_size_photo === "Yes" && !candidate.full_photo_url)     return { sentTo: null };
    if (req.photo_cv        === "Yes" && !candidate.photo_url)          return { sentTo: null };

    const [offices, processingPct] = await Promise.all([
      loadActiveOffices(managerId),
      loadProcessingPct(managerId),
    ]);
    if (offices.length === 0) return { sentTo: null };

    // Priority 1: office in candidate's country with capacity
    const countryOffices = offices.filter((o) => o.countryName && o.countryName === candidate.musaned_status);

    // Count current CVs per office to respect base limit
    const allOfficeNames = offices.map((o) => o.name);
    const { data: currentDist } = await supabaseAdmin
      .from("candidates")
      .select("cv_sent_to")
      .eq("manager_id", managerId)
      .eq("status", "available")
      .in("cv_sent_to", allOfficeNames);

    const currentCount: Record<string, number> = {};
    for (const row of currentDist ?? []) {
      if (row.cv_sent_to) currentCount[row.cv_sent_to] = (currentCount[row.cv_sent_to] ?? 0) + 1;
    }

    // Find best office
    let chosen: string | null = null;

    // Try country-matched offices with capacity first
    for (const o of countryOffices) {
      if ((currentCount[o.name] ?? 0) < basePerOffice) { chosen = o.name; break; }
    }

    // Fall back to office with highest selection %
    if (!chosen) {
      const sortedByPct = [...offices].sort(
        (a, b) => (processingPct[b.name] ?? 0) - (processingPct[a.name] ?? 0),
      );
      chosen = sortedByPct[0]?.name ?? null;
    }

    if (!chosen) return { sentTo: null };

    const today = new Date().toISOString().split("T")[0];
    await supabaseAdmin
      .from("candidates")
      .update({ cv_sent_to: chosen, cv_sent_date: today } as never)
      .eq("id", data.candidateId)
      .eq("manager_id", managerId);

    return { sentTo: chosen };
  });

// Assigns unassigned + stuck-at-locked candidates — does NOT reset active assignments
export const autoDistributeUnassigned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const managerId = await resolveManagerId(context.userId);
    if (!managerId) return { assigned: 0 };

    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("cv_page_requirements")
      .eq("id", managerId)
      .maybeSingle();
    const basePerOffice = parseInt(((profileRow?.cv_page_requirements as Record<string, string>) ?? {}).base_per_office ?? "15", 10) || 15;

    const [offices, processingPct, lockedRes] = await Promise.all([
      loadActiveOffices(managerId),
      loadProcessingPct(managerId),
      supabaseAdmin.from("assignment_offices").select("name").eq("manager_id", managerId).eq("is_locked", true),
    ]);
    if (offices.length === 0) return { assigned: 0 };

    const lockedNames = (lockedRes.data ?? []).map((o) => o.name);

    // Pick up: (a) candidates with no office, (b) candidates stuck at a locked office
    const [nullRes, lockedStuckRes] = await Promise.all([
      supabaseAdmin
        .from("candidates")
        .select("id, musaned_status, cv_sent_to")
        .eq("manager_id", managerId)
        .eq("status", "available")
        .is("selected_by", null)
        .is("cv_sent_to", null),
      lockedNames.length > 0
        ? supabaseAdmin
            .from("candidates")
            .select("id, musaned_status, cv_sent_to")
            .eq("manager_id", managerId)
            .eq("status", "available")
            .is("selected_by", null)
            .in("cv_sent_to", lockedNames)
        : Promise.resolve({ data: [] as Array<{ id: string; musaned_status: string | null; cv_sent_to: string | null }> }),
    ]);

    const candidates = [...(nullRes.data ?? []), ...(lockedStuckRes.data ?? [])];
    if (!candidates.length) return { assigned: 0 };

    // Track old offices so locked-office moves are recorded in cv_resent_offices
    const oldOffices: Record<string, string | null> = {};
    for (const c of candidates) oldOffices[c.id] = c.cv_sent_to;

    const assignment = runAlgorithm(candidates, offices, processingPct, basePerOffice);
    const assigned = await applyAssignment(managerId, assignment);
    await trackResentOffices(managerId, assignment, oldOffices);
    return { assigned };
  });
