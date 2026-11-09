import { supabaseAdmin } from "@/integrations/supabase/client.server";
export { supabaseAdmin };

export async function resolveManagerId(userId: string): Promise<string | null> {
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

export async function loadActiveOffices(managerId: string): Promise<OfficeMeta[]> {
  const [{ data: officesRaw }, { data: countriesRaw }] = await Promise.all([
    supabaseAdmin.from("assignment_offices").select("name, country_id, is_locked").eq("manager_id", managerId),
    supabaseAdmin.from("assignment_countries").select("id, name").eq("manager_id", managerId),
  ]);
  const countryMap = new Map((countriesRaw ?? []).map((c) => [c.id, c.name]));
  return (officesRaw ?? [])
    .filter((o) => !(o as any).is_locked)
    .map((o) => ({ name: o.name, countryName: countryMap.get(o.country_id) ?? null }));
}

export async function loadProcessingPct(managerId: string): Promise<Record<string, number>> {
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

export function runAlgorithm(
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

  for (const c of candidates) {
    if (assignment[c.id]) continue;
    const chosen = offices.find((o) => excludeFor[c.id] !== o.name) ?? offices[0];
    assignment[c.id] = chosen.name;
  }

  return assignment;
}

export async function applyAssignment(
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

export async function trackResentOffices(
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

export async function redistributeFromLockedOffice(
  managerId: string,
  lockedOfficeName: string,
  basePerOffice: number,
): Promise<number> {
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

  const excludeFor = Object.fromEntries(candidates.map((c) => [c.id, lockedOfficeName]));
  const assignment = runAlgorithm(candidates, offices, processingPct, basePerOffice, excludeFor);

  await applyAssignment(managerId, assignment);
  await trackResentOffices(managerId, assignment, excludeFor);

  return candidates.length;
}
