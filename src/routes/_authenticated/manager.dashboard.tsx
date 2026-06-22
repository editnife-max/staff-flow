import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState, useRef } from "react";
import {
  Users, Clock, CheckCircle2, XCircle, AlertTriangle,
  UserPlus, Stethoscope, X, ChevronRight, RotateCcw, Send, Settings,
  Upload, Download, FileUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Candidate = Database["public"]["Tables"]["candidates"]["Row"];

export const Route = createFileRoute("/_authenticated/manager/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Staff-Flow" }] }),
  component: ManagerDashboard,
});

const STATUS_CONFIG = [
  {
    key: "available",
    label: "Available",
    icon: Users,
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    icon_bg: "bg-emerald-100 dark:bg-emerald-900/60",
    icon_color: "text-emerald-600 dark:text-emerald-400",
    value_color: "text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  {
    key: "processing",
    label: "Processing",
    icon: Clock,
    bg: "bg-amber-50 dark:bg-amber-950/40",
    icon_bg: "bg-amber-100 dark:bg-amber-900/60",
    icon_color: "text-amber-600 dark:text-amber-400",
    value_color: "text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  {
    key: "arrived",
    label: "Arrived",
    icon: CheckCircle2,
    bg: "bg-blue-50 dark:bg-blue-950/40",
    icon_bg: "bg-blue-100 dark:bg-blue-900/60",
    icon_color: "text-blue-600 dark:text-blue-400",
    value_color: "text-blue-700 dark:text-blue-300",
    bar: "bg-blue-500",
  },
  {
    key: "canceled",
    label: "Canceled",
    icon: XCircle,
    bg: "bg-red-50 dark:bg-red-950/40",
    icon_bg: "bg-red-100 dark:bg-red-900/60",
    icon_color: "text-red-600 dark:text-red-400",
    value_color: "text-red-700 dark:text-red-300",
    bar: "bg-red-500",
  },
  {
    key: "returned",
    label: "Returned",
    icon: RotateCcw,
    bg: "bg-orange-50 dark:bg-orange-950/40",
    icon_bg: "bg-orange-100 dark:bg-orange-900/60",
    icon_color: "text-orange-600 dark:text-orange-400",
    value_color: "text-orange-700 dark:text-orange-300",
    bar: "bg-orange-500",
  },
] as const;

const STATUS_PILL: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  processing: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  arrived: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  canceled: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  returned: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
};

function MgrPaginationBar({
  total, page, pageSize, onPage, onPageSize,
}: {
  total: number; page: number; pageSize: number;
  onPage: (p: number) => void; onPageSize: (s: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = Math.min((page - 1) * pageSize + 1, total);
  const end = Math.min(page * pageSize, total);
  const getPages = (): (number | "...")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pts: (number | "...")[] = [1];
    if (page > 3) pts.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pts.push(i);
    if (page < totalPages - 2) pts.push("...");
    pts.push(totalPages);
    return pts;
  };
  return (
    <div className="flex items-center justify-between gap-3 pt-3 flex-wrap border-t border-border mt-1">
      <div className="flex items-center gap-1 flex-wrap">
        {getPages().map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="px-1 text-muted-foreground text-xs">…</span>
          ) : (
            <button key={p} type="button" onClick={() => onPage(p as number)}
              className={cn("h-6 min-w-[24px] px-1.5 text-xs rounded-none border transition-colors",
                p === page ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/60")}>
              {p}
            </button>
          )
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">{start}–{end} of {total}</span>
        <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}
          className="h-6 text-xs border border-border bg-background rounded-none px-1 outline-none cursor-pointer">
          {[5, 10, 50, 100, 500].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    </div>
  );
}

function PaginatedDialogList({ items, renderItem }: { items: Candidate[]; renderItem: (c: Candidate) => React.ReactNode }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const paginated = items.slice((page - 1) * pageSize, page * pageSize);
  return (
    <>
      <div className="max-h-[50vh] overflow-y-auto space-y-0 divide-y divide-border">
        {paginated.map((c) => renderItem(c))}
      </div>
      <MgrPaginationBar total={items.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} />
    </>
  );
}

function LmisDocSection({
  label, url, onUpload, onRemove,
}: {
  label: string; url: string;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try { await onUpload(file); } finally { setUploading(false); }
  };

  const isImage = url && !url.endsWith(".pdf");
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between min-h-[20px]">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-0.5 text-[11px] text-primary hover:underline">
            <Download className="h-3 w-3" /> View
          </a>
        )}
      </div>
      <div className="relative">
        <div
          role="button" tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          className={cn(
            "border-2 border-dashed rounded-none cursor-pointer transition-colors flex flex-col items-center justify-center gap-1.5 min-h-[90px] p-2 bg-muted/20 select-none",
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/60",
          )}
        >
          {uploading ? (
            <span className="text-xs text-muted-foreground animate-pulse">Uploading…</span>
          ) : dragOver ? (
            <><Upload className="h-5 w-5 text-primary" /><span className="text-xs text-primary">Drop to upload</span></>
          ) : url ? (
            <>
              {isImage
                ? <img src={url} alt={label} className="max-h-[60px] max-w-full object-contain rounded-none" />
                : <><FileUp className="h-7 w-7 text-muted-foreground" /><span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{url.split("/").pop()?.slice(0, 20)}</span></>}
              <span className="text-[10px] text-primary">Click to replace</span>
            </>
          ) : (
            <><Upload className="h-5 w-5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Click or drag &amp; drop</span></>
          )}
        </div>
        {url && !uploading && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-1 right-1 h-5 w-5 flex items-center justify-center rounded-none bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}

function ManagerDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [medOpen, setMedOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [tasheerOpen, setTasheerOpen] = useState(false);
  const [tasheerDismissed, setTasheerDismissed] = useState(false);
  const [cvOpen, setCvOpen] = useState(false);
  const [cvDismissed, setCvDismissed] = useState(false);
  const [cvDaysEdit, setCvDaysEdit] = useState(false);
  const [cvDaysDraft, setCvDaysDraft] = useState("");
  const [cocNoOpen, setCocNoOpen] = useState(false);
  const [cocNoDismissed, setCocNoDismissed] = useState(false);
  const [cocPlacedOpen, setCocPlacedOpen] = useState(false);
  const [cocPlacedDismissed, setCocPlacedDismissed] = useState(false);
  const [medNotFitOpen, setMedNotFitOpen] = useState(false);
  const [medNotFitDismissed, setMedNotFitDismissed] = useState(false);
  const [cocDoneMedNotFitOpen, setCocDoneMedNotFitOpen] = useState(false);
  const [cocDoneMedNotFitDismissed, setCocDoneMedNotFitDismissed] = useState(false);
  const [visaReturnedOpen, setVisaReturnedOpen] = useState(false);
  const [visaReturnedDismissed, setVisaReturnedDismissed] = useState(false);
  const [readyForEmbassyOpen, setReadyForEmbassyOpen] = useState(false);
  const [readyForEmbassyDismissed, setReadyForEmbassyDismissed] = useState(false);
  const [tasheerReadyOpen, setTasheerReadyOpen] = useState(false);
  const [tasheerReadyDismissed, setTasheerReadyDismissed] = useState(false);
  const [tasheerOverdueOpen, setTasheerOverdueOpen] = useState(false);
  const [tasheerOverdueDismissed, setTasheerOverdueDismissed] = useState(false);
  const [fitLmisNotTestedOpen, setFitLmisNotTestedOpen] = useState(false);
  const [fitLmisNotTestedDismissed, setFitLmisNotTestedDismissed] = useState(false);
  const [lmisDraftImportedOpen, setLmisDraftImportedOpen] = useState(false);
  const [lmisDraftImportedDismissed, setLmisDraftImportedDismissed] = useState(false);
  const [lmisFilesCandidate, setLmisFilesCandidate] = useState<Candidate | null>(null);

  const { data: candidates = [] } = useQuery({
    queryKey: ["dashboard-candidates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Candidate[];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["manager-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("cv_days_threshold")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const cvDaysThreshold = profile?.cv_days_threshold ?? 7;

  const updateThresholdMut = useMutation({
    mutationFn: async (days: number) => {
      const { error } = await supabase
        .from("profiles")
        .update({ cv_days_threshold: days })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manager-profile", user?.id] }),
  });

  const updateLmisMut = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string | null }) => {
      const { error } = await (supabase.from("candidates") as any).update({ [field]: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard-candidates", user?.id] }),
  });

  const uploadLmisFile = async (candidateId: string, file: File, field: string) => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `lmis/${candidateId}/${field}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("candidate-files").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("candidate-files").getPublicUrl(path);
    updateLmisMut.mutate({ id: candidateId, field, value: data.publicUrl });
  };

  const counts = {
    available: candidates.filter((c) => c.status === "available").length,
    processing: candidates.filter((c) => c.status === "processing").length,
    arrived: candidates.filter((c) => c.status === "arrived").length,
    canceled: candidates.filter((c) => c.status === "canceled").length,
    returned: candidates.filter((c) => c.status === "returned").length,
  };
  const total = candidates.length;

  const medExpired = candidates.filter((c) => c.medical_status === "Expired");
  const tasheerDoneWokalaUnpaid = candidates.filter(
    (c) => c.status === "processing" && c.tasheer_status === "Done" && c.wokala_status === "Unpaid",
  );
  const cocNo = candidates.filter((c) => c.coc_status === "No");
  const cocPlaced = candidates.filter((c) => c.coc_status === "Placed");
  const medNotFit = candidates.filter((c) => c.medical_status === "Unfit");
  const cocDoneMedNotFit = candidates.filter((c) => c.coc_status === "Done" && c.medical_status === "Unfit");
  const visaReturned = candidates.filter((c) => c.visa_status === "Returned");
  const readyForEmbassy = candidates.filter((c) => c.status === "processing" && c.visa_status === "Ready for embassy");
  const tasheerReady = candidates.filter((c) => c.status === "processing" && c.tasheer_status === "Ready");
  const recent = candidates.slice(0, 12);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tasheerOverdue = candidates.filter((c) => {
    if (c.tasheer_status !== "Booked" || !c.tasheer_date) return false;
    return new Date(c.tasheer_date + "T00:00:00") < today;
  });
  const fitLmisNotTested = candidates.filter((c) => c.medical_status === "Fit" && c.coc_status === "Done" && (!c.lmis_status || c.lmis_status === "Not tested"));
  const lmisDraftImported = candidates.filter((c) => c.lmis_status === "Draft" || c.lmis_status === "Imported");

  const cvOverdue = candidates.filter((c) => {
    if (!c.cv_sent_to || c.selected_by || !c.cv_sent_date) return false;
    const days = Math.floor((today.getTime() - new Date(c.cv_sent_date + "T00:00:00").getTime()) / 86_400_000);
    return days >= cvDaysThreshold;
  });

  return (
    <div className="space-y-6 mx-[79.6px]">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <Button asChild size="sm" className="gap-2 text-xs h-8 rounded-none">
          <Link to="/manager/candidates">
            <UserPlus className="h-4 w-4" /> Manage Candidates
          </Link>
        </Button>
      </div>

      {/* Medical Expired Banner */}
      {medExpired.length > 0 && !dismissed && (
        <div
          className="flex items-center justify-between gap-3 rounded-none border border-orange-300 bg-orange-50 dark:bg-orange-950/40 dark:border-orange-700 px-4 py-3 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors"
          onClick={() => setMedOpen(true)}
        >
          <div className="flex items-center gap-3">
            <Stethoscope className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                Medical Expired — {medExpired.length} candidate{medExpired.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400">
                Click to view candidates with expired medical status
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ChevronRight className="h-4 w-4 text-orange-500" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
              className="p-1 rounded-none text-orange-400 hover:text-orange-700 hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tasheer Done + Wokala Unpaid Banner */}
      {tasheerDoneWokalaUnpaid.length > 0 && !tasheerDismissed && (
        <div
          className="flex items-center justify-between gap-3 rounded-none border border-violet-300 bg-violet-50 dark:bg-violet-950/40 dark:border-violet-700 px-4 py-3 cursor-pointer hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
          onClick={() => setTasheerOpen(true)}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-violet-600 dark:text-violet-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">
                Tasheer Done but Wokala Unpaid — {tasheerDoneWokalaUnpaid.length} candidate{tasheerDoneWokalaUnpaid.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-violet-600 dark:text-violet-400">
                Click to view candidates with Tasheer Done but Wokala not yet paid
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ChevronRight className="h-4 w-4 text-violet-500" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setTasheerDismissed(true); }}
              className="p-1 rounded-none text-violet-400 hover:text-violet-700 hover:bg-violet-200 dark:hover:bg-violet-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* COC — No Banner */}
      {cocNo.length > 0 && !cocNoDismissed && (
        <div
          className="flex items-center justify-between gap-3 rounded-none border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/40 dark:border-yellow-700 px-4 py-3 cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/40 transition-colors"
          onClick={() => setCocNoOpen(true)}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                COC — No — {cocNo.length} candidate{cocNo.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                Click to view candidates with COC status No
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ChevronRight className="h-4 w-4 text-yellow-500" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCocNoDismissed(true); }}
              className="p-1 rounded-none text-yellow-400 hover:text-yellow-700 hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* COC — Placed Banner */}
      {cocPlaced.length > 0 && !cocPlacedDismissed && (
        <div
          className="flex items-center justify-between gap-3 rounded-none border border-violet-300 bg-violet-50 dark:bg-violet-950/40 dark:border-violet-700 px-4 py-3 cursor-pointer hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
          onClick={() => setCocPlacedOpen(true)}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-violet-600 dark:text-violet-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">
                COC — Placed — {cocPlaced.length} candidate{cocPlaced.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-violet-600 dark:text-violet-400">
                Click to view candidates with COC status Placed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ChevronRight className="h-4 w-4 text-violet-500" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCocPlacedDismissed(true); }}
              className="p-1 rounded-none text-violet-400 hover:text-violet-700 hover:bg-violet-200 dark:hover:bg-violet-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Medical Not Fit Banner */}
      {medNotFit.length > 0 && !medNotFitDismissed && (
        <div
          className="flex items-center justify-between gap-3 rounded-none border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-700 px-4 py-3 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
          onClick={() => setMedNotFitOpen(true)}
        >
          <div className="flex items-center gap-3">
            <Stethoscope className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                Medical Not Fit — {medNotFit.length} candidate{medNotFit.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">
                Click to view candidates with Medical status Not Fit
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ChevronRight className="h-4 w-4 text-red-500" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMedNotFitDismissed(true); }}
              className="p-1 rounded-none text-red-400 hover:text-red-700 hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* COC Done + Medical Not Fit Banner */}
      {cocDoneMedNotFit.length > 0 && !cocDoneMedNotFitDismissed && (
        <div
          className="flex items-center justify-between gap-3 rounded-none border border-rose-300 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-700 px-4 py-3 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
          onClick={() => setCocDoneMedNotFitOpen(true)}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">
                COC Done — Medical Not Fit — {cocDoneMedNotFit.length} candidate{cocDoneMedNotFit.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Click to view candidates with COC Done but Medical Not Fit
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ChevronRight className="h-4 w-4 text-rose-500" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCocDoneMedNotFitDismissed(true); }}
              className="p-1 rounded-none text-rose-400 hover:text-rose-700 hover:bg-rose-200 dark:hover:bg-rose-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Medical Fit — LMIS Not Tested Banner */}
      {fitLmisNotTested.length > 0 && !fitLmisNotTestedDismissed && (
        <div
          className="flex items-center justify-between gap-3 rounded-none border border-teal-300 bg-teal-50 dark:bg-teal-950/40 dark:border-teal-700 px-4 py-3 cursor-pointer hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors"
          onClick={() => setFitLmisNotTestedOpen(true)}
        >
          <div className="flex items-center gap-3">
            <Stethoscope className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-teal-800 dark:text-teal-200">
                Medical Fit — LMIS Not Tested — {fitLmisNotTested.length} candidate{fitLmisNotTested.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-teal-600 dark:text-teal-400">
                Click to view candidates with Medical Fit and LMIS Not Tested
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ChevronRight className="h-4 w-4 text-teal-500" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFitLmisNotTestedDismissed(true); }}
              className="p-1 rounded-none text-teal-400 hover:text-teal-700 hover:bg-teal-200 dark:hover:bg-teal-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* LMIS Draft / Imported Banner */}
      {lmisDraftImported.length > 0 && !lmisDraftImportedDismissed && (
        <div
          className="flex items-center justify-between gap-3 rounded-none border border-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-700 px-4 py-3 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
          onClick={() => setLmisDraftImportedOpen(true)}
        >
          <div className="flex items-center gap-3">
            <Upload className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">
                LMIS Files Needed — {lmisDraftImported.length} candidate{lmisDraftImported.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400">
                LMIS status is Draft or Imported — click to upload files
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ChevronRight className="h-4 w-4 text-indigo-500" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLmisDraftImportedDismissed(true); }}
              className="p-1 rounded-none text-indigo-400 hover:text-indigo-700 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Visa Returned Banner */}
      {visaReturned.length > 0 && !visaReturnedDismissed && (
        <div
          className="flex items-center justify-between gap-3 rounded-none border border-sky-300 bg-sky-50 dark:bg-sky-950/40 dark:border-sky-700 px-4 py-3 cursor-pointer hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors"
          onClick={() => setVisaReturnedOpen(true)}
        >
          <div className="flex items-center gap-3">
            <RotateCcw className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-sky-800 dark:text-sky-200">
                Visa Returned — {visaReturned.length} candidate{visaReturned.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-sky-600 dark:text-sky-400">
                Click to view candidates with Visa status Returned
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ChevronRight className="h-4 w-4 text-sky-500" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setVisaReturnedDismissed(true); }}
              className="p-1 rounded-none text-sky-400 hover:text-sky-700 hover:bg-sky-200 dark:hover:bg-sky-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Ready for Embassy Banner */}
      {readyForEmbassy.length > 0 && !readyForEmbassyDismissed && (
        <div
          className="flex items-center justify-between gap-3 rounded-none border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-700 px-4 py-3 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
          onClick={() => setReadyForEmbassyOpen(true)}
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                Ready for Embassy — {readyForEmbassy.length} candidate{readyForEmbassy.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Click to view candidates ready for embassy visa
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ChevronRight className="h-4 w-4 text-emerald-500" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setReadyForEmbassyDismissed(true); }}
              className="p-1 rounded-none text-emerald-400 hover:text-emerald-700 hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tasheer Ready (Passport Rejected) Banner */}
      {tasheerReady.length > 0 && !tasheerReadyDismissed && (
        <div
          className="flex items-center justify-between gap-3 rounded-none border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 px-4 py-3 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
          onClick={() => setTasheerReadyOpen(true)}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Tasheer Ready (Passport Rejected) — {tasheerReady.length} candidate{tasheerReady.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Click to view candidates with passport rejected, awaiting resubmission
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ChevronRight className="h-4 w-4 text-amber-500" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setTasheerReadyDismissed(true); }}
              className="p-1 rounded-none text-amber-400 hover:text-amber-700 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tasheer Overdue Banner */}
      {tasheerOverdue.length > 0 && !tasheerOverdueDismissed && (
        <div
          className="flex items-center justify-between gap-3 rounded-none border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 px-4 py-3 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
          onClick={() => setTasheerOverdueOpen(true)}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Tasheer Overdue — {tasheerOverdue.length} candidate{tasheerOverdue.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Tasheer was Booked but the date has passed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ChevronRight className="h-4 w-4 text-amber-500" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setTasheerOverdueDismissed(true); }}
              className="p-1 rounded-none text-amber-400 hover:text-amber-700 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* CV Overdue Banner */}
      {cvOverdue.length > 0 && !cvDismissed && (
        <div
          className="flex items-center justify-between gap-3 rounded-none border border-teal-300 bg-teal-50 dark:bg-teal-950/40 dark:border-teal-700 px-4 py-3 cursor-pointer hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors"
          onClick={() => setCvOpen(true)}
        >
          <div className="flex items-center gap-3">
            <Send className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-teal-800 dark:text-teal-200">
                CV Sent — No Selection — {cvOverdue.length} candidate{cvOverdue.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-teal-600 dark:text-teal-400">
                CV sent over {cvDaysThreshold} day{cvDaysThreshold !== 1 ? "s" : ""} ago with no selection. Click to view or adjust threshold.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCvDaysDraft(String(cvDaysThreshold)); setCvDaysEdit(true); setCvOpen(true); }}
              className="p-1 rounded-none text-teal-400 hover:text-teal-700 hover:bg-teal-200 dark:hover:bg-teal-800 transition-colors"
              aria-label="Configure days threshold"
            >
              <Settings className="h-4 w-4" />
            </button>
            <ChevronRight className="h-4 w-4 text-teal-500" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCvDismissed(true); }}
              className="p-1 rounded-none text-teal-400 hover:text-teal-700 hover:bg-teal-200 dark:hover:bg-teal-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-2">
        {STATUS_CONFIG.map((s) => {
          const count = counts[s.key];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const Icon = s.icon;
          return (
            <div key={s.key} className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-none", s.bg)}>
              <div className={cn("h-7 w-7 rounded-none grid place-items-center shrink-0", s.icon_bg)}>
                <Icon className={cn("h-3.5 w-3.5", s.icon_color)} />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-1">
                  <span className={cn("text-lg font-bold leading-tight", s.value_color)}>{count}</span>
                </div>
                <p className="text-[11px] text-foreground/70 font-medium truncate">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Requests */}
      <Card className="rounded-none">
        <CardHeader className="pb-3 px-5 pt-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Requests</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs h-7 rounded-none gap-1">
              <Link to="/manager/candidates">View all <ChevronRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {recent.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No candidates yet.
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-border">
              {recent.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                    <AvatarFallback className="text-[11px] rounded-none">
                      {c.full_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[c.occupation, c.country].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-none capitalize", STATUS_PILL[c.status] ?? "bg-muted text-muted-foreground")}>
                      {c.status}
                    </span>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Medical Expired Dialog */}
      <Dialog open={medOpen} onOpenChange={setMedOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <AlertTriangle className="h-5 w-5" />
              Medical Expired ({medExpired.length})
            </DialogTitle>
          </DialogHeader>
          <PaginatedDialogList items={medExpired} renderItem={(c) => (
            <div key={c.id} className="flex items-center gap-3 py-3">
              <Avatar className="h-9 w-9 shrink-0">
                {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                <AvatarFallback className="text-[11px] rounded-none">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{[c.occupation, c.passport_number].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">Expired</span>
                <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.status}</p>
              </div>
            </div>
          )} />
          <div className="pt-2 flex justify-end">
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setMedOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tasheer Done + Wokala Unpaid Dialog */}
      <Dialog open={tasheerOpen} onOpenChange={setTasheerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
              <AlertTriangle className="h-5 w-5" />
              Tasheer Done — Wokala Unpaid ({tasheerDoneWokalaUnpaid.length})
            </DialogTitle>
          </DialogHeader>
          <PaginatedDialogList items={tasheerDoneWokalaUnpaid} renderItem={(c) => (
            <div key={c.id} className="flex items-center gap-3 py-3">
              <Avatar className="h-9 w-9 shrink-0">
                {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                <AvatarFallback className="text-[11px] rounded-none">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{[c.occupation, c.passport_number].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">Wokala Unpaid</span>
                <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.status}</p>
              </div>
            </div>
          )} />
          <div className="pt-2 flex justify-end">
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setTasheerOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* COC — No Dialog */}
      <Dialog open={cocNoOpen} onOpenChange={setCocNoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
              <AlertTriangle className="h-5 w-5" />
              COC — No ({cocNo.length})
            </DialogTitle>
          </DialogHeader>
          <PaginatedDialogList items={cocNo} renderItem={(c) => (
            <div key={c.id} className="flex items-center gap-3 py-3">
              <Avatar className="h-9 w-9 shrink-0">
                {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                <AvatarFallback className="text-[11px] rounded-none">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{[c.occupation, c.passport_number].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300">No</span>
                <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.status}</p>
              </div>
            </div>
          )} />
          <div className="pt-2 flex justify-end">
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setCocNoOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* COC — Placed Dialog */}
      <Dialog open={cocPlacedOpen} onOpenChange={setCocPlacedOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
              <AlertTriangle className="h-5 w-5" />
              COC — Placed ({cocPlaced.length})
            </DialogTitle>
          </DialogHeader>
          <PaginatedDialogList items={cocPlaced} renderItem={(c) => (
            <div key={c.id} className="flex items-center gap-3 py-3">
              <Avatar className="h-9 w-9 shrink-0">
                {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                <AvatarFallback className="text-[11px] rounded-none">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{[c.occupation, c.passport_number].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">Placed</span>
                <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.status}</p>
              </div>
            </div>
          )} />
          <div className="pt-2 flex justify-end">
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setCocPlacedOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Medical Not Fit Dialog */}
      <Dialog open={medNotFitOpen} onOpenChange={setMedNotFitOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <Stethoscope className="h-5 w-5" />
              Medical Not Fit ({medNotFit.length})
            </DialogTitle>
          </DialogHeader>
          <PaginatedDialogList items={medNotFit} renderItem={(c) => (
            <div key={c.id} className="flex items-center gap-3 py-3">
              <Avatar className="h-9 w-9 shrink-0">
                {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                <AvatarFallback className="text-[11px] rounded-none">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{[c.occupation, c.passport_number].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">Unfit</span>
                <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.status}</p>
              </div>
            </div>
          )} />
          <div className="pt-2 flex justify-end">
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setMedNotFitOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* COC Done + Medical Not Fit Dialog */}
      <Dialog open={cocDoneMedNotFitOpen} onOpenChange={setCocDoneMedNotFitOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <AlertTriangle className="h-5 w-5" />
              COC Done — Medical Not Fit ({cocDoneMedNotFit.length})
            </DialogTitle>
          </DialogHeader>
          <PaginatedDialogList items={cocDoneMedNotFit} renderItem={(c) => (
            <div key={c.id} className="flex items-center gap-3 py-3">
              <Avatar className="h-9 w-9 shrink-0">
                {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                <AvatarFallback className="text-[11px] rounded-none">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{[c.occupation, c.passport_number].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">Medical Unfit</span>
                <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.status}</p>
              </div>
            </div>
          )} />
          <div className="pt-2 flex justify-end">
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setCocDoneMedNotFitOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Visa Returned Dialog */}
      <Dialog open={visaReturnedOpen} onOpenChange={setVisaReturnedOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sky-700 dark:text-sky-300">
              <RotateCcw className="h-5 w-5" />
              Visa Returned ({visaReturned.length})
            </DialogTitle>
          </DialogHeader>
          <PaginatedDialogList items={visaReturned} renderItem={(c) => (
            <div key={c.id} className="flex items-center gap-3 py-3">
              <Avatar className="h-9 w-9 shrink-0">
                {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                <AvatarFallback className="text-[11px] rounded-none">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{[c.occupation, c.passport_number].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">Returned</span>
                <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.status}</p>
              </div>
            </div>
          )} />
          <div className="pt-2 flex justify-end">
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setVisaReturnedOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ready for Embassy Dialog */}
      <Dialog open={readyForEmbassyOpen} onOpenChange={setReadyForEmbassyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
              Ready for Embassy ({readyForEmbassy.length})
            </DialogTitle>
          </DialogHeader>
          <PaginatedDialogList items={readyForEmbassy} renderItem={(c) => (
            <div key={c.id} className="flex items-center gap-3 py-3">
              <Avatar className="h-9 w-9 shrink-0">
                {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                <AvatarFallback className="text-[11px] rounded-none">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{[c.occupation, c.passport_number].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">Ready for Embassy</span>
                <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.status}</p>
              </div>
            </div>
          )} />
          <div className="pt-2 flex justify-end">
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setReadyForEmbassyOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tasheer Ready (Passport Rejected) Dialog */}
      <Dialog open={tasheerReadyOpen} onOpenChange={setTasheerReadyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5" />
              Tasheer Ready — Passport Rejected ({tasheerReady.length})
            </DialogTitle>
          </DialogHeader>
          <PaginatedDialogList items={tasheerReady} renderItem={(c) => (
            <div key={c.id} className="flex items-center gap-3 py-3">
              <Avatar className="h-9 w-9 shrink-0">
                {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                <AvatarFallback className="text-[11px] rounded-none">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{[c.occupation, c.passport_number].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">Passport Rejected</span>
                <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.status}</p>
              </div>
            </div>
          )} />
          <div className="pt-2 flex justify-end">
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setTasheerReadyOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tasheer Overdue Dialog */}
      <Dialog open={tasheerOverdueOpen} onOpenChange={setTasheerOverdueOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5" />
              Tasheer Overdue ({tasheerOverdue.length})
            </DialogTitle>
          </DialogHeader>
          <PaginatedDialogList items={tasheerOverdue} renderItem={(c) => {
            const days = c.tasheer_date
              ? Math.floor((today.getTime() - new Date(c.tasheer_date + "T00:00:00").getTime()) / 86_400_000)
              : null;
            return (
              <div key={c.id} className="flex items-center gap-3 py-3">
                <Avatar className="h-9 w-9 shrink-0">
                  {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                  <AvatarFallback className="text-[11px] rounded-none">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    Booked: {c.tasheer_date ? new Date(c.tasheer_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
                    {days !== null ? ` · ${days}d overdue` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">Overdue</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.status}</p>
                </div>
              </div>
            );
          }} />
          <div className="pt-2 flex justify-end">
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setTasheerOverdueOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Medical Fit — LMIS Not Tested Dialog */}
      <Dialog open={fitLmisNotTestedOpen} onOpenChange={setFitLmisNotTestedOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-teal-700 dark:text-teal-300">
              <Stethoscope className="h-5 w-5" />
              Medical Fit — LMIS Not Tested ({fitLmisNotTested.length})
            </DialogTitle>
          </DialogHeader>
          <PaginatedDialogList items={fitLmisNotTested} renderItem={(c) => (
            <div key={c.id} className="flex items-center gap-3 py-3">
              <Avatar className="h-9 w-9 shrink-0">
                {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                <AvatarFallback className="text-[11px] rounded-none">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{[c.occupation, c.passport_number].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">Not Tested</span>
                <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.status}</p>
              </div>
            </div>
          )} />
          <div className="pt-2 flex justify-end">
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setFitLmisNotTestedOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CV Overdue Dialog */}
      <Dialog open={cvOpen} onOpenChange={setCvOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-teal-700 dark:text-teal-300">
              <Send className="h-5 w-5" />
              CV Sent — No Selection ({cvOverdue.length})
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 mb-2 text-sm">
            <span className="text-muted-foreground">Alert threshold:</span>
            {cvDaysEdit ? (
              <span className="flex items-center gap-1.5">
                <input
                  autoFocus
                  type="number"
                  min={1}
                  value={cvDaysDraft}
                  onChange={(e) => setCvDaysDraft(e.target.value)}
                  className="w-14 border border-input rounded-none px-2 h-7 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const n = parseInt(cvDaysDraft);
                      if (!isNaN(n) && n > 0) updateThresholdMut.mutate(n);
                      setCvDaysEdit(false);
                    }
                    if (e.key === "Escape") setCvDaysEdit(false);
                  }}
                />
                <span className="text-xs text-muted-foreground">days</span>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    const n = parseInt(cvDaysDraft);
                    if (!isNaN(n) && n > 0) updateThresholdMut.mutate(n);
                    setCvDaysEdit(false);
                  }}
                >
                  Save
                </button>
                <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setCvDaysEdit(false)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="flex items-center gap-1 font-semibold text-foreground hover:underline"
                onClick={() => { setCvDaysDraft(String(cvDaysThreshold)); setCvDaysEdit(true); }}
              >
                {cvDaysThreshold} days
                <Settings className="h-3 w-3 opacity-50" />
              </button>
            )}
          </div>
          <PaginatedDialogList items={cvOverdue} renderItem={(c) => {
            const days = c.cv_sent_date
              ? Math.floor((today.getTime() - new Date(c.cv_sent_date + "T00:00:00").getTime()) / 86_400_000)
              : null;
            return (
              <div key={c.id} className="flex items-center gap-3 py-3">
                <Avatar className="h-9 w-9 shrink-0">
                  {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                  <AvatarFallback className="text-[11px] rounded-none">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">Sent to: {c.cv_sent_to}{days !== null ? ` · ${days}d ago` : ""}</p>
                </div>
                <div className="shrink-0">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">
                    {days !== null ? `${days}d overdue` : "Overdue"}
                  </span>
                </div>
              </div>
            );
          }} />
          <div className="pt-2 flex justify-end">
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setCvOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* LMIS Draft / Imported — List Dialog */}
      <Dialog open={lmisDraftImportedOpen} onOpenChange={setLmisDraftImportedOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
              <Upload className="h-5 w-5" />
              LMIS Files Needed ({lmisDraftImported.length})
            </DialogTitle>
          </DialogHeader>
          <PaginatedDialogList items={lmisDraftImported} renderItem={(c) => (
            <div key={c.id} className="flex items-center gap-3 py-3">
              <Avatar className="h-9 w-9 shrink-0">
                {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                <AvatarFallback className="text-[11px] rounded-none">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{[c.occupation, c.passport_number].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className={cn(
                  "text-[11px] font-medium px-2 py-0.5 rounded-none",
                  c.lmis_status === "Draft"
                    ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    : "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
                )}>
                  {c.lmis_status}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] px-2 rounded-none gap-1"
                  onClick={() => setLmisFilesCandidate(c)}
                >
                  <Upload className="h-3 w-3" /> Files
                </Button>
              </div>
            </div>
          )} />
          <div className="pt-2 flex justify-end">
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setLmisDraftImportedOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* LMIS Files Upload Dialog */}
      {lmisFilesCandidate && (() => {
        const c = lmisFilesCandidate as any;
        return (
          <Dialog open onOpenChange={(o) => { if (!o) setLmisFilesCandidate(null); }}>
            <DialogContent className="max-w-2xl rounded-none">
              <DialogHeader>
                <DialogTitle className="text-base">LMIS Documents — {lmisFilesCandidate.full_name}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <LmisDocSection label="INSU" url={c.lmis_insu_url ?? ""}
                  onUpload={(f) => uploadLmisFile(lmisFilesCandidate.id, f, "lmis_insu_url")}
                  onRemove={() => updateLmisMut.mutate({ id: lmisFilesCandidate.id, field: "lmis_insu_url", value: null })} />
                <LmisDocSection label="COC" url={c.lmis_coc_url ?? ""}
                  onUpload={(f) => uploadLmisFile(lmisFilesCandidate.id, f, "lmis_coc_url")}
                  onRemove={() => updateLmisMut.mutate({ id: lmisFilesCandidate.id, field: "lmis_coc_url", value: null })} />
                <LmisDocSection label={c.lmis_id_url && c.lmis_id_relative_url ? "ID'S — Candidate" : "ID (Candidate)"} url={c.lmis_id_url ?? ""}
                  onUpload={(f) => uploadLmisFile(lmisFilesCandidate.id, f, "lmis_id_url")}
                  onRemove={() => updateLmisMut.mutate({ id: lmisFilesCandidate.id, field: "lmis_id_url", value: null })} />
                <LmisDocSection label={c.lmis_id_url && c.lmis_id_relative_url ? "ID'S — Relative" : "ID (Relative)"} url={c.lmis_id_relative_url ?? ""}
                  onUpload={(f) => uploadLmisFile(lmisFilesCandidate.id, f, "lmis_id_relative_url")}
                  onRemove={() => updateLmisMut.mutate({ id: lmisFilesCandidate.id, field: "lmis_id_relative_url", value: null })} />
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
