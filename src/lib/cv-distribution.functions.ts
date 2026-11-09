import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const distributeCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveManagerId, loadActiveOffices, loadProcessingPct, runAlgorithm, applyAssignment, trackResentOffices, supabaseAdmin } =
      await import("@/lib/cv-distribution.server");

    const managerId = await resolveManagerId(context.userId);
    if (!managerId) throw new Error("Manager not found");

    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("cv_page_requirements")
      .eq("id", managerId)
      .maybeSingle();
    const req = (profileRow?.cv_page_requirements as Record<string, string>) ?? {};
    const basePerOffice = parseInt(req.base_per_office ?? "15", 10) || 15;

    const [offices, processingPct] = await Promise.all([
      loadActiveOffices(managerId),
      loadProcessingPct(managerId),
    ]);
    if (offices.length === 0) return { assigned: 0, byOffice: {} };

    const { data: candidates } = await supabaseAdmin
      .from("candidates")
      .select("id, musaned_status, cv_sent_to")
      .eq("manager_id", managerId)
      .eq("status", "available")
      .is("selected_by", null);
    if (!candidates || candidates.length === 0) return { assigned: 0, byOffice: {} };

    const oldOffices: Record<string, string | null> = {};
    for (const c of candidates) oldOffices[c.id] = c.cv_sent_to;

    const ids = candidates.map((c) => c.id);
    await supabaseAdmin
      .from("candidates")
      .update({ cv_sent_to: null, cv_sent_date: null } as never)
      .in("id", ids)
      .eq("manager_id", managerId);

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

    const assignment = runAlgorithm(candidates, offices, processingPct, basePerOffice);

    const assigned = await applyAssignment(managerId, assignment);
    await trackResentOffices(managerId, assignment, oldOffices);

    const byOffice: Record<string, number> = {};
    for (const office of Object.values(assignment)) {
      byOffice[office] = (byOffice[office] ?? 0) + 1;
    }

    return { assigned, byOffice };
  });

export const checkAndResendExpiredCvs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveManagerId, loadActiveOffices, loadProcessingPct, runAlgorithm, applyAssignment, trackResentOffices, supabaseAdmin } =
      await import("@/lib/cv-distribution.server");

    const managerId = await resolveManagerId(context.userId);
    if (!managerId) return { redistributed: 0 };

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
  .validator((input: unknown) => z.object({ candidateId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { resolveManagerId, loadActiveOffices, loadProcessingPct, supabaseAdmin } =
      await import("@/lib/cv-distribution.server");

    const managerId = await resolveManagerId(context.userId);
    if (!managerId) return { sentTo: null };

    const { data: candidate } = await supabaseAdmin
      .from("candidates")
      .select("id, musaned_status, status, medical_status, coc_status, narrative, experience, selected_by, passport_scan_url, full_photo_url, photo_url")
      .eq("id", data.candidateId)
      .eq("manager_id", managerId)
      .maybeSingle();

    if (!candidate || candidate.status !== "available" || candidate.selected_by) return { sentTo: null };

    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("cv_page_requirements")
      .eq("id", managerId)
      .maybeSingle();
    const req = (profileRow?.cv_page_requirements as Record<string, string>) ?? {};
    const basePerOffice = parseInt(req.base_per_office ?? "15", 10) || 15;

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

    const countryOffices = offices.filter((o) => o.countryName && o.countryName === candidate.musaned_status);

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

    let chosen: string | null = null;

    for (const o of countryOffices) {
      if ((currentCount[o.name] ?? 0) < basePerOffice) { chosen = o.name; break; }
    }

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

export const autoDistributeUnassigned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveManagerId, loadActiveOffices, loadProcessingPct, runAlgorithm, applyAssignment, trackResentOffices, supabaseAdmin } =
      await import("@/lib/cv-distribution.server");

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

    const oldOffices: Record<string, string | null> = {};
    for (const c of candidates) oldOffices[c.id] = c.cv_sent_to;

    const assignment = runAlgorithm(candidates, offices, processingPct, basePerOffice);
    const assigned = await applyAssignment(managerId, assignment);
    await trackResentOffices(managerId, assignment, oldOffices);
    return { assigned };
  });
