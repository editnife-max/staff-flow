// Pure CV-distribution logic — no imports, so it runs unchanged in Deno (edge
// function) and Node (local checks).

// ── CV readiness ──────────────────────────────────────────────────────────────

/** Same defaults the manager sees on the CV Page Requirements dialog. */
export const DEFAULT_CV_REQUIREMENTS: Record<string, string> = {
  medical: "Fit",
  coc: "Done",
  narrative: "all",
  experience: "all",
  passport_scan: "all",
  full_size_photo: "all",
  photo_cv: "all",
  base_per_office: "15",
};

export interface ReadinessCandidate {
  cv_approved: boolean | null;
  medical_status: string | null;
  coc_status: string | null;
  narrative: string | null;
  experience: string | null;
  passport_scan_url: string | null;
  full_photo_url: string | null;
  photo_url: string | null;
}

/** Returns the reasons a candidate is NOT ready. Empty array = CV ready. */
export function cvReadinessProblems(
  c: ReadinessCandidate,
  saved: Record<string, unknown> | null | undefined,
): string[] {
  const req = { ...DEFAULT_CV_REQUIREMENTS, ...((saved ?? {}) as Record<string, string>) };
  const problems: string[] = [];
  if (c.cv_approved !== true) problems.push("CV not approved");
  const match = (key: string, value: string | null, label: string) => {
    const want = req[key];
    if (want && want !== "all" && (value ?? "") !== want) problems.push(`${label} is not ${want}`);
  };
  match("medical", c.medical_status, "Medical");
  match("coc", c.coc_status, "COC");
  match("narrative", c.narrative, "Narrative");
  match("experience", c.experience, "Experience");
  if (req.passport_scan === "Yes" && !c.passport_scan_url) problems.push("Missing passport scan");
  if (req.full_size_photo === "Yes" && !c.full_photo_url) problems.push("Missing full-size photo");
  if (req.photo_cv === "Yes" && !c.photo_url) problems.push("Missing CV photo");
  return problems;
}

export function isTrainee(availabilityType: string | null | undefined): boolean {
  return availabilityType === "TC" || availabilityType === "TC_failed";
}

/** Processing candidates past this point stay with their office when it is locked. */
export function isPastPointOfNoReturn(c: {
  visa_status: string | null;
  ticket_status: string | null;
}): boolean {
  return (
    c.visa_status === "Issued" || c.visa_status === "Arrived KSA" || c.ticket_status === "Booked"
  );
}

/** Employer-specific work that is reset when a processing candidate leaves a locked office. */
export const EMPLOYER_RESET_PATCH: Record<string, null | string> = {
  status: "available",
  selected_by: null,
  contract_date: null,
  office: null,
  destination_country: null,
  tasheer_status: null,
  tasheer_date: null,
  wokala_status: null,
  embassy_date: null,
  visa_status: null,
  lmis_status: null,
  lmis_contract_phase: null,
  ticket_status: null,
  ticket_date: null,
  arrival_city: null,
  musaned_visa_number: null,
  musaned_employer_city: null,
  musaned_employer_name: null,
  musaned_employer_phone: null,
  musaned_house_number: null,
  musaned_contract_start: null,
  musaned_contract_end: null,
};

export function normCountry(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

// ── Allocation ────────────────────────────────────────────────────────────────

export interface AllocOffice {
  name: string;
  country: string;
  /** 1–5 stars set by the manager. */
  rating: number;
  /** CVs this office already holds (count against the base limit). */
  held: number;
  /** Candidates this office currently has in processing (its hiring performance). */
  processing: number;
}

export interface AllocCandidate {
  id: string;
  country: string;
  /** Offices this candidate must not go to (already had the CV). */
  exclude: string[];
}

export interface AllocResult {
  assignment: Record<string, string>;
  /** Candidates no office could take (every office in their country excluded). */
  unplaced: string[];
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/**
 * Turn-based allocation inside each country.
 *
 * Phase 1 (base): offices below the base limit take turns. Priority is
 *   rating / (held + 1), so more stars = more turns, and offices that already
 *   hold many CVs wait. Equal priority → alphabetical office name.
 * Phase 2 (overflow, every office at the base limit): priority is
 *   weight / (overflow_received + 1), where weight blends stars and hiring
 *   performance 50/50, so a well-performing office rated low still gets a fair share.
 *
 * Candidates are taken in the order given (oldest first is the caller's job).
 */
export function allocate(
  candidates: AllocCandidate[],
  offices: AllocOffice[],
  baseLimit: number,
): AllocResult {
  const assignment: Record<string, string> = {};
  const unplaced: string[] = [];
  const base = Math.max(1, Math.floor(baseLimit));

  const byCountry = new Map<string, AllocCandidate[]>();
  for (const c of candidates) {
    const k = normCountry(c.country);
    if (!byCountry.has(k)) byCountry.set(k, []);
    byCountry.get(k)!.push(c);
  }

  for (const [country, pool] of byCountry) {
    const local = offices.filter((o) => normCountry(o.country) === country).sort(byName);
    if (local.length === 0) {
      unplaced.push(...pool.map((c) => c.id));
      continue;
    }

    const remaining = [...pool];
    const held = new Map(local.map((o) => [o.name, o.held]));
    const overflowGot = new Map(local.map((o) => [o.name, 0]));
    const excluded = new Map(remaining.map((c) => [c.id, new Set(c.exclude)]));

    const takeFor = (office: string): AllocCandidate | null => {
      const idx = remaining.findIndex((c) => !excluded.get(c.id)!.has(office));
      return idx === -1 ? null : remaining.splice(idx, 1)[0];
    };
    const canTake = (office: string) => remaining.some((c) => !excluded.get(c.id)!.has(office));

    const pick = (
      eligible: AllocOffice[],
      priority: (o: AllocOffice) => number,
    ): AllocOffice | null => {
      let best: AllocOffice | null = null;
      let bestP = -Infinity;
      for (const o of eligible) {
        const p = priority(o);
        // `local` is name-sorted, so strict > keeps the alphabetical tie-break
        if (p > bestP + 1e-12) {
          best = o;
          bestP = p;
        }
      }
      return best;
    };

    // Phase 1 — fill up to the base limit
    while (remaining.length > 0) {
      const eligible = local.filter((o) => held.get(o.name)! < base && canTake(o.name));
      const o = pick(eligible, (x) => x.rating / (held.get(x.name)! + 1));
      if (!o) break;
      const c = takeFor(o.name)!;
      assignment[c.id] = o.name;
      held.set(o.name, held.get(o.name)! + 1);
    }

    // Phase 2 — overflow
    if (remaining.length > 0) {
      const maxProc = Math.max(0, ...local.map((o) => o.processing));
      const weight = (o: AllocOffice) =>
        maxProc > 0 ? 0.5 * (o.rating / 5) + 0.5 * (o.processing / maxProc) : o.rating / 5;
      while (remaining.length > 0) {
        const eligible = local.filter((o) => canTake(o.name));
        const o = pick(eligible, (x) => weight(x) / (overflowGot.get(x.name)! + 1));
        if (!o) break;
        const c = takeFor(o.name)!;
        assignment[c.id] = o.name;
        overflowGot.set(o.name, overflowGot.get(o.name)! + 1);
      }
    }

    unplaced.push(...remaining.map((c) => c.id));
  }

  return { assignment, unplaced };
}
