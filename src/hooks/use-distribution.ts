import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_CV_EXPIRY_DAYS = 6;

/** Days an office has to respond before its CVs move on — one global value set by the admin. */
export function useCvExpiryDays(): number {
  const { data } = useQuery({
    queryKey: ["system-setting", "cv_expiry_days"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "cv_expiry_days")
        .maybeSingle();
      if (error) throw error;
      return Number(data?.value ?? DEFAULT_CV_EXPIRY_DAYS) || DEFAULT_CV_EXPIRY_DAYS;
    },
  });
  return data ?? DEFAULT_CV_EXPIRY_DAYS;
}

export type DistributionReport = {
  assigned: number;
  byOffice: Record<string, number>;
  moved: Array<{ id: string; name: string; from: string; to: string }>;
  skipped: {
    no_country: Array<{ id: string; name: string }>;
    no_office_for_country: Array<{ id: string; name: string; country: string }>;
    not_ready: Array<{ id: string; name: string; problems: string[] }>;
    no_other_office: Array<{ id: string; name: string; office: string }>;
    kept_processing: Array<{ id: string; name: string; reason: string }>;
    rejected: Array<{ id: string; name: string; reason: string }>;
  };
  totals: Record<string, number>;
  baseLimit?: number;
  expiryDays?: number;
  officeName?: string;
  note?: string;
};

export type DistributionJob = {
  id: string;
  kind: "distribute" | "expiry" | "office_locked" | "manual_send";
  trigger: "manual" | "scheduled" | "system";
  status: "pending" | "running" | "done" | "failed" | "cancelled";
  result: DistributionReport | null;
  error: string | null;
  run_at: string;
  created_at: string;
  finished_at: string | null;
};

const JOB_COLS = "id, kind, trigger, status, result, error, run_at, created_at, finished_at";
const isFinished = (s: DistributionJob["status"] | undefined) =>
  s === "done" || s === "failed" || s === "cancelled";

async function fetchJob(id: string): Promise<DistributionJob | null> {
  const { data, error } = await supabase
    .from("distribution_jobs")
    .select(JOB_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as DistributionJob) ?? null;
}

/** Live view of one job — polls while it is queued or running. */
export function useDistributionJob(jobId: string | null | undefined) {
  return useQuery({
    queryKey: ["distribution-job", jobId],
    enabled: !!jobId,
    queryFn: () => fetchJob(jobId!),
    refetchInterval: (q) => (isFinished(q.state.data?.status) ? false : 1_000),
  });
}

/** The manager's most recent finished jobs (for "last run" displays). */
export function useRecentDistributionJobs(managerId: string | undefined, limit = 5) {
  return useQuery({
    queryKey: ["distribution-jobs-recent", managerId, limit],
    enabled: !!managerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("distribution_jobs")
        .select(JOB_COLS)
        .eq("manager_id", managerId!)
        .in("status", ["done", "failed"])
        .order("finished_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as DistributionJob[];
    },
  });
}

/** Wait (polling) until a queued job finishes. */
export async function waitForDistributionJob(
  id: string,
  timeoutMs = 120_000,
): Promise<DistributionJob> {
  const start = Date.now();
  for (;;) {
    const job = await fetchJob(id);
    if (job && isFinished(job.status)) return job;
    if (Date.now() - start > timeoutMs)
      throw new Error("Distribution is still running in the background — check back shortly.");
    await new Promise((r) => setTimeout(r, 1_000));
  }
}

/** One-line human summary for toasts. */
export function summarizeReport(r: DistributionReport | null | undefined): string {
  if (!r) return "No result";
  const t = r.totals ?? {};
  const parts: string[] = [];
  parts.push(`${r.assigned} sent`);
  if (t.moved) parts.push(`${t.moved} moved`);
  const needCountry = (t.no_country ?? 0) + (t.no_office_for_country ?? 0);
  if (needCountry) parts.push(`${needCountry} need a country/office`);
  if (t.not_ready) parts.push(`${t.not_ready} not CV ready`);
  if (t.rejected) parts.push(`${t.rejected} rejected`);
  return parts.join(" · ");
}
