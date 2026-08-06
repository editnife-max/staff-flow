import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import React, { useState, useEffect, useRef } from "react";
import {
  Users, Clock, CheckCircle2, XCircle, RotateCcw, UserPlus, ChevronRight, FileSpreadsheet,
  Stethoscope, FileCheck, ClipboardList, Ticket, FileText, CalendarX, Landmark, BadgeCheck,
  AlertTriangle, Send, Upload, Download, X, MapPin, TrendingUp, Trash2,
} from "lucide-react";
// xlsx-js-style is loaded lazily inside downloadCandidatesExcel (client-only)
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import { updateCandidateField, deleteCandidate } from "@/lib/candidates.functions";

type Candidate = Database["public"]["Tables"]["candidates"]["Row"];

export const Route = createFileRoute("/_authenticated/manager/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Staff-Flow" }] }),
  component: ManagerDashboard,
});

// ─── Stat cards ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = [
  { key: "available" as const, label: "Available", icon: Users,
    bg: "bg-emerald-50 dark:bg-emerald-950/40", icon_bg: "bg-emerald-100 dark:bg-emerald-900/60",
    icon_color: "text-emerald-600 dark:text-emerald-400", value_color: "text-emerald-700 dark:text-emerald-300" },
  { key: "processing" as const, label: "Processing", icon: Clock,
    bg: "bg-amber-50 dark:bg-amber-950/40", icon_bg: "bg-amber-100 dark:bg-amber-900/60",
    icon_color: "text-amber-600 dark:text-amber-400", value_color: "text-amber-700 dark:text-amber-300" },
  { key: "arrived" as const, label: "Arrived", icon: CheckCircle2,
    bg: "bg-blue-50 dark:bg-blue-950/40", icon_bg: "bg-blue-100 dark:bg-blue-900/60",
    icon_color: "text-blue-600 dark:text-blue-400", value_color: "text-blue-700 dark:text-blue-300" },
  { key: "canceled" as const, label: "Canceled", icon: XCircle,
    bg: "bg-red-50 dark:bg-red-950/40", icon_bg: "bg-red-100 dark:bg-red-900/60",
    icon_color: "text-red-600 dark:text-red-400", value_color: "text-red-700 dark:text-red-300" },
  { key: "returned" as const, label: "Returned", icon: RotateCcw,
    bg: "bg-orange-50 dark:bg-orange-950/40", icon_bg: "bg-orange-100 dark:bg-orange-900/60",
    icon_color: "text-orange-600 dark:text-orange-400", value_color: "text-orange-700 dark:text-orange-300" },
];

const ALERT_PILL: Record<string, string> = {
  coc:       "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  medical:   "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  medexp:    "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  lmis:      "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  ticket:    "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  embassy:   "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
  visaready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  visareturn:"bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  waitreplace:  "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  deletepending:"bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  tasheer:   "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  cvoverdue: "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
  fitlmis:   "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
  arrival:   "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
};

// ─── Excel export ────────────────────────────────────────────────────────────
type ExportCol = { key: string; label: string };
const BASE: ExportCol[] = [
  { key: "full_name",       label: "Full Name" },
  { key: "passport_number", label: "Passport No." },
];

const PRIMARY   = "1A3A52"; // navy  — header background
const SECONDARY = "5CB8C4"; // teal  — row number column background
const WHITE     = "FFFFFF";

function styledCell(value: string | number, style: Record<string, unknown>) {
  return { v: value, t: typeof value === "number" ? "n" : "s", s: style };
}

async function downloadCandidatesExcel(candidates: Candidate[], title: string, cols: ExportCol[]) {
  const XLSX = await import("xlsx-js-style");
  const headerStyle = {
    fill: { fgColor: { rgb: PRIMARY } },
    font: { bold: true, color: { rgb: WHITE }, sz: 11 },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: { bottom: { style: "thin", color: { rgb: WHITE } } },
  };
  const numHeaderStyle = {
    ...headerStyle,
    fill: { fgColor: { rgb: SECONDARY } },
  };
  const numCellStyle = {
    fill: { fgColor: { rgb: SECONDARY } },
    font: { bold: true, color: { rgb: WHITE }, sz: 10 },
    alignment: { horizontal: "center", vertical: "center" },
  };
  const dataCellStyle = {
    alignment: { vertical: "center", wrapText: false },
    font: { sz: 10 },
  };

  // Build header row: # column + data columns
  const headerRow = [
    styledCell("#", numHeaderStyle),
    ...cols.map((c) => styledCell(c.label, headerStyle)),
  ];

  // Build data rows
  const dataRows = candidates.map((c, i) => [
    styledCell(i + 1, numCellStyle),
    ...cols.map((col) => {
      const v = (c as any)[col.key];
      return styledCell(v == null ? "" : String(v), dataCellStyle);
    }),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

  // Column widths: # col narrow, data cols auto-fit
  const allCols = ["#", ...cols.map((c) => c.label)];
  ws["!cols"] = allCols.map((h, i) => ({
    wch: i === 0 ? 5 : Math.max(
      h.length,
      ...dataRows.map((r) => String((r[i] as any)?.v ?? "").length),
      12,
    ),
  }));

  // Freeze header row
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Candidates");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title} — ${candidates.length} candidates.xlsx`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// ─── Pagination bar ──────────────────────────────────────────────────────────
function PaginationBar({
  total, page, pageSize, onPage, onPageSize, onBackToTop,
}: {
  total: number; page: number; pageSize: number;
  onPage: (p: number) => void; onPageSize: (s: number) => void; onBackToTop: () => void;
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
    <div className="flex items-center justify-between gap-3 pt-3 pb-1 flex-wrap border-t border-border mt-2">
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
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground whitespace-nowrap">{start}–{end} of {total}</span>
        <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}
          className="h-6 text-xs border border-border bg-background rounded-none px-1 outline-none cursor-pointer">
          {[5, 10, 50, 100, 500].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button type="button" onClick={onBackToTop}
          className="text-xs text-muted-foreground hover:text-foreground underline whitespace-nowrap">
          Back to top
        </button>
      </div>
    </div>
  );
}

// ─── Medical re-book popup button ────────────────────────────────────────────
function MedicalBookButton({ candidateName, onConfirm }: {
  candidateName: string;
  onConfirm: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  return (
    <>
      <Button size="sm" variant="outline" className="rounded-none text-xs h-7 px-2"
        onClick={() => { setOpen(true); setDate(""); }}>
        Re-Book
      </Button>
      <Dialog open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
        <DialogContent className="max-w-sm rounded-none">
          <DialogHeader><DialogTitle>Book Medical</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Enter the medical appointment date for <strong>{candidateName}</strong>.
          </p>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-none h-9" />
          <DialogFooter>
            <Button variant="ghost" className="rounded-none" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!date} className="rounded-none" onClick={() => { onConfirm(date); setOpen(false); }}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Ticket booking popup button ─────────────────────────────────────────────
function TicketBookButton({ candidateName, onConfirm }: {
  candidateName: string;
  onConfirm: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  return (
    <>
      <Button size="sm" variant="outline" className="rounded-none text-xs h-7 px-2"
        onClick={() => { setOpen(true); setDate(""); }}>
        Mark Booked
      </Button>
      <Dialog open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
        <DialogContent className="max-w-sm rounded-none">
          <DialogHeader><DialogTitle>Book Ticket</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Enter the ticket date for <strong>{candidateName}</strong>.
          </p>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-none h-9" />
          <DialogFooter>
            <Button variant="ghost" className="rounded-none" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!date} className="rounded-none" onClick={() => { onConfirm(date); setOpen(false); }}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── COC status select with mandatory booking date when "Booked" ─────────────
function CocBookButton({ candidate, onConfirm }: {
  candidate: Candidate;
  onConfirm: (status: string, date?: string) => void;
}) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [date, setDate] = useState("");

  const handleSelect = (v: string) => {
    if (v === "Booked") {
      setPendingStatus(v);
      setDate("");
      setBookingOpen(true);
    } else {
      onConfirm(v);
    }
  };

  return (
    <>
      <Select onValueChange={handleSelect}>
        <SelectTrigger className="h-7 text-xs rounded-none w-[130px]">
          <SelectValue placeholder="Set COC" />
        </SelectTrigger>
        <SelectContent>
          {["Done", "No", "Booked", "Placed", "Yitazez", "Pending release"].map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Dialog open={bookingOpen} onOpenChange={(o) => { if (!o) setBookingOpen(false); }}>
        <DialogContent className="max-w-sm rounded-none">
          <DialogHeader><DialogTitle>COC Booking Date</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Enter the COC booking date for <strong>{candidate.full_name}</strong>.
          </p>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-none h-9" />
          <DialogFooter>
            <Button variant="ghost" className="rounded-none" onClick={() => setBookingOpen(false)}>Cancel</Button>
            <Button disabled={!date} className="rounded-none" onClick={() => {
              if (pendingStatus) onConfirm(pendingStatus, date);
              setBookingOpen(false);
            }}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── LMIS file upload components ─────────────────────────────────────────────
async function downloadLmisAsPdf(url: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const ext = (url.split(".").pop()?.split("?")[0] ?? "").toLowerCase();
    const isImage = ["jpg", "jpeg", "png", "webp", "bmp"].includes(ext) || blob.type.startsWith("image/");
    if (isImage) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target!.result as string);
        reader.readAsDataURL(blob);
      });
      const img = new Image();
      await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = dataUrl; });
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: img.width > img.height ? "landscape" : "portrait", unit: "mm" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pw / img.width, ph / img.height);
      pdf.addImage(dataUrl, ext === "png" ? "PNG" : "JPEG", (pw - img.width * ratio) / 2, (ph - img.height * ratio) / 2, img.width * ratio, img.height * ratio);
      pdf.save("lmis_file.pdf");
    } else {
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl; a.download = "lmis_file.pdf";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
    }
  } catch { console.error("Download failed"); }
}

function LmisDocSection({ label, url, onUpload, onRemove }: {
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
          <button type="button" onClick={() => downloadLmisAsPdf(url)}
            className="flex items-center gap-0.5 text-[11px] text-primary hover:underline">
            <Download className="h-3 w-3" /> Download
          </button>
        )}
      </div>
      <div className="relative">
        <div role="button" tabIndex={0}
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
                : <><Upload className="h-7 w-7 text-muted-foreground" /><span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{url.split("/").pop()?.slice(0, 20)}</span></>}
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

function LmisUploadButton({ candidate, onUpdate }: {
  candidate: Candidate;
  onUpdate: (field: string, value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const c = candidate as any;
  const upload = async (file: File, field: string) => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `lmis/${candidate.id}/${field}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("candidate-files").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("candidate-files").getPublicUrl(path);
    onUpdate(field, data.publicUrl);
  };
  const hasBothIds = !!(c.lmis_id_url && c.lmis_id_relative_url);
  return (
    <>
      <Button size="sm" variant="outline" className="h-6 text-[12px] px-2 rounded-none gap-1" onClick={() => setOpen(true)}>
        <Upload className="h-3 w-3" /> Files
      </Button>
      {open && (
        <Dialog open onOpenChange={(o) => { if (!o) setOpen(false); }}>
          <DialogContent className="max-w-2xl rounded-none">
            <DialogHeader>
              <DialogTitle className="text-base">LMIS Documents — {candidate.full_name}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 pt-1">
              <LmisDocSection label="INSU" url={c.lmis_insu_url ?? ""}
                onUpload={(f) => upload(f, "lmis_insu_url")} onRemove={() => onUpdate("lmis_insu_url", null)} />
              <LmisDocSection label="COC" url={c.lmis_coc_url ?? ""}
                onUpload={(f) => upload(f, "lmis_coc_url")} onRemove={() => onUpdate("lmis_coc_url", null)} />
              <LmisDocSection label={hasBothIds ? "ID'S — Candidate" : "ID (Candidate)"} url={c.lmis_id_url ?? ""}
                onUpload={(f) => upload(f, "lmis_id_url")} onRemove={() => onUpdate("lmis_id_url", null)} />
              <LmisDocSection label={hasBothIds ? "ID'S — Relative" : "ID (Relative)"} url={c.lmis_id_relative_url ?? ""}
                onUpload={(f) => upload(f, "lmis_id_relative_url")} onRemove={() => onUpdate("lmis_id_relative_url", null)} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ─── Alert section ───────────────────────────────────────────────────────────
function AlertSection({
  icon: Icon, title, iconColor, pillKey, candidates, getNote, renderBadge, exportCols, onUpdateField, renderCardAction,
}: {
  icon: React.ElementType;
  title: string;
  iconColor: string;
  pillKey: keyof typeof ALERT_PILL;
  candidates: Candidate[];
  getNote?: (c: Candidate) => string | null;
  renderBadge?: (c: Candidate) => React.ReactNode;
  exportCols: ExportCol[];
  onUpdateField: (id: string, field: string, value: string | null) => void;
  renderCardAction?: (candidate: Candidate) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState("all");
  const listRef = useRef<HTMLDivElement>(null);
  if (candidates.length === 0) return null;

  const statusSet = new Set(candidates.map((c) => c.status));
  const filtered = statusFilter === "all" ? candidates : candidates.filter((c) => c.status === statusFilter);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <button
        type="button"
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
        onClick={() => { setOpen(true); setPage(1); }}
      >
        <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
        <span className="flex-1 text-sm font-medium truncate">{title}</span>
        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-none shrink-0", ALERT_PILL[pillKey])}>
          {candidates.length}
        </span>
        <span
          role="button"
          title="Download Excel"
          className="p-1 rounded-none text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors shrink-0"
          onClick={(e) => { e.stopPropagation(); downloadCandidatesExcel(filtered, title, exportCols); }}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); setStatusFilter("all"); setPage(1); } }}>
        <DialogContent className="max-w-lg rounded-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className={cn("h-5 w-5", iconColor)} />
              {title} ({filtered.length}{filtered.length !== candidates.length ? ` / ${candidates.length}` : ""})
            </DialogTitle>
          </DialogHeader>
          {statusSet.size > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => { setStatusFilter("all"); setPage(1); }} className={cn("px-2.5 py-1 text-xs font-medium rounded-none border transition-colors", statusFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground")}>All <span className="opacity-70">{candidates.length}</span></button>
              {(["available","processing","arrived","canceled","returned"] as const).filter((s) => statusSet.has(s)).map((s) => (
                <button key={s} type="button" onClick={() => { setStatusFilter(s); setPage(1); }} className={cn("px-2.5 py-1 text-xs font-medium rounded-none border transition-colors", statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground")}>
                  {s.charAt(0).toUpperCase() + s.slice(1)} <span className="opacity-70">{candidates.filter((c) => c.status === s).length}</span>
                </button>
              ))}
            </div>
          )}
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto divide-y divide-border">
            {paginated.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-3">
                <Avatar className="h-9 w-9 shrink-0">
                  {c.photo_url && <AvatarImage src={c.photo_url} alt={c.full_name} />}
                  <AvatarFallback className="text-[11px] rounded-none">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{[c.occupation, c.passport_number].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {renderCardAction?.(c)}
                  <div className="text-right">
                    {renderBadge ? renderBadge(c) : getNote?.(c) ? (
                      <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-none", ALERT_PILL[pillKey])}>
                        {getNote(c)}
                      </span>
                    ) : null}
                    <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.status}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <PaginationBar
            total={filtered.length} page={page} pageSize={pageSize}
            onPage={setPage}
            onPageSize={(s) => { setPageSize(s); setPage(1); }}
            onBackToTop={() => listRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          />
          <div className="pt-2 flex items-center justify-between">
            <Button size="sm" variant="outline" className="rounded-none text-xs gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-900/20"
              onClick={() => downloadCandidatesExcel(filtered, title, exportCols)}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Download Excel
            </Button>
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
function ManagerDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  const { data: assignCountries = [] } = useQuery({
    queryKey: ["assignment-countries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("assignment_countries").select("name").order("name");
      if (error) throw error;
      return data as { name: string }[];
    },
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name, role_title, status").order("name");
      if (error) throw error;
      return data as { id: string; name: string; role_title: string | null; status: string }[];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["manager-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("cv_days_threshold").eq("id", user!.id).maybeSingle();
      return data;
    },
  });
  const managerCvThreshold = profile?.cv_days_threshold ?? 7;
  const [embassyOverwrite, setEmbassyOverwrite] = useState<string | null>(null);
  const [replacePending, setReplacePending] = useState<Candidate | null>(null);
  const [replaceReason, setReplaceReason] = useState("Replacement sent");
  const [replaceNotes, setReplaceNotes] = useState("");

  const removeFn = useServerFn(deleteCandidate);
  const fieldMut = useMutation({
    mutationFn: (vars: { id: string; field: string; value: string | null }) =>
      updateCandidateField({ data: vars as never }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard-candidates", user?.id] }),
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard-candidates", user?.id] }),
  });

  const handleUpdateField = (id: string, field: string, value: string | null) => {
    fieldMut.mutate({ id, field, value });
    if (field === "medical_status" && value !== "Fit") {
      const c = candidates.find((c) => c.id === id);
      if (c?.medical_status === "Fit") fieldMut.mutate({ id, field: "medical_date", value: null });
    }
    if (field === "visa_status" && value === "Arrived KSA")
      fieldMut.mutate({ id, field: "status", value: "arrived" });
    if (field === "tasheer_status" && value === "No") {
      fieldMut.mutate({ id, field: "wokala_status", value: null });
      fieldMut.mutate({ id, field: "tasheer_date", value: null });
      fieldMut.mutate({ id, field: "visa_status", value: null });
      fieldMut.mutate({ id, field: "embassy_date", value: null });
    }
    if (field === "tasheer_status" && value === "Done") {
      const c = candidates.find((c) => c.id === id);
      if (c?.wokala_status === "Paid")
        fieldMut.mutate({ id, field: "visa_status", value: "Ready for embassy" });
    }
    if (field === "wokala_status" && value === "Paid") {
      const c = candidates.find((c) => c.id === id);
      if (c?.tasheer_status === "Done")
        fieldMut.mutate({ id, field: "visa_status", value: "Ready for embassy" });
    }
    if (field === "lmis_status") {
      const c = candidates.find((c) => c.id === id);
      if (value === "Issued" && c?.visa_status === "Issued")
        fieldMut.mutate({ id, field: "ticket_status", value: "Ready" });
      else if (value !== "Issued" && c?.ticket_status === "Ready")
        fieldMut.mutate({ id, field: "ticket_status", value: null });
    }
    if (field === "visa_status") {
      const c = candidates.find((c) => c.id === id);
      if (value === "Issued" && c?.lmis_status === "Issued")
        fieldMut.mutate({ id, field: "ticket_status", value: "Ready" });
      else if (value !== "Issued" && c?.ticket_status === "Ready")
        fieldMut.mutate({ id, field: "ticket_status", value: null });
      if (!value) fieldMut.mutate({ id, field: "embassy_date", value: null });
      if (value === "Sent to Embassy") {
        if ((c as any)?.embassy_date) {
          setEmbassyOverwrite(id);
        } else {
          fieldMut.mutate({ id, field: "embassy_date", value: new Date().toISOString().split("T")[0] });
        }
      }
    }
  };

  const medExpiryChecked = useRef<Set<string>>(new Set());
  useEffect(() => {
    const today = new Date();
    for (const c of candidates) {
      if (medExpiryChecked.current.has(c.id)) continue;
      if (c.medical_status === "Fit" && c.medical_date) {
        const diffDays = Math.floor((today.getTime() - new Date(c.medical_date + "T00:00:00").getTime()) / 86400000);
        if (diffDays >= 90) {
          medExpiryChecked.current.add(c.id);
          fieldMut.mutate({ id: c.id, field: "medical_status", value: "Expired" });
        }
      }
    }
  }, [candidates]);

  const total = candidates.length;
  const counts = {
    available:  candidates.filter((c) => c.status === "available").length,
    processing: candidates.filter((c) => c.status === "processing").length,
    arrived:    candidates.filter((c) => c.status === "arrived").length,
    canceled:   candidates.filter((c) => c.status === "canceled").length,
    returned:   candidates.filter((c) => c.status === "returned").length,
  };

  const staffStats = staffList
    .map((s) => {
      const assigned  = candidates.filter((c) => (c as any).assigned_staff_id === s.id);
      const arrived    = assigned.filter((c) => c.status === "arrived").length;
      const processing = assigned.filter((c) => c.status === "processing").length;
      const canceled   = assigned.filter((c) => c.status === "canceled").length;
      const returned   = assigned.filter((c) => c.status === "returned").length;
      const tot        = assigned.length;
      const rate       = tot > 0 ? Math.round((arrived / tot) * 100) : 0;
      return { ...s, total: tot, arrived, processing, canceled, returned, rate };
    })
    .sort((a, b) => b.arrived - a.arrived || b.total - a.total);

  const avgRate = staffStats.length > 0
    ? Math.round(staffStats.reduce((s, r) => s + r.rate, 0) / staffStats.length)
    : 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const alertCandidates = candidates.filter((c) => c.status !== "arrived" && c.status !== "canceled");

  // ── Compliance & Recruitment sections ───────────────────────────────────────
  const cocNo         = alertCandidates.filter((c) => c.coc_status === "No");
  const cocPlaced     = alertCandidates.filter((c) => c.coc_status === "Placed");
  const medicalNotFit = alertCandidates.filter((c) => c.medical_status && c.medical_status !== "Fit");
  const cocDoneNotFit = alertCandidates.filter((c) => c.coc_status === "Done" && c.medical_status && c.medical_status !== "Fit");

  const medicalExpired = alertCandidates.filter((c) => {
    if (c.medical_status === "Expired") return true;
    if (c.medical_status === "Fit" && c.medical_date) {
      const days = Math.floor((today.getTime() - new Date(c.medical_date + "T00:00:00").getTime()) / 86_400_000);
      return days >= 90;
    }
    return false;
  });

  const daysSince = (d: string) =>
    Math.floor((today.getTime() - new Date(d + "T00:00:00").getTime()) / 86_400_000);

  const processingRef = (c: Candidate) =>
    c.contract_date ?? c.created_at?.split("T")[0] ?? null;

  const noMedical5Days = alertCandidates.filter((c) => {
    if (c.status !== "processing") return false;
    const medNo = c.medical_status === "No";
    const medEmpty = !c.medical_status || c.medical_status.trim() === "";
    if (!medNo && !medEmpty) return false;
    if (medNo) return true;
    const ref = processingRef(c);
    return !!ref && daysSince(ref) >= 5;
  });
  const noTasheer10Days = alertCandidates.filter((c) => {
    if (c.status !== "processing") return false;
    const tasheerNo = c.tasheer_status === "No";
    const tasheerEmpty = !c.tasheer_status || c.tasheer_status.trim() === "";
    if (!tasheerNo && !tasheerEmpty) return false;
    if (tasheerNo) return true;
    const ref = processingRef(c);
    return !!ref && daysSince(ref) >= 10;
  });

  // ── Logistics & Deployment sections ─────────────────────────────────────────
  const ticketNotBooked = alertCandidates.filter((c) => {
    if (!c.contract_date) return false;
    if (c.ticket_status === "Booked") return false;
    const days = Math.floor((today.getTime() - new Date(c.contract_date + "T00:00:00").getTime()) / 86_400_000);
    return days > 20;
  });

const visaReady = alertCandidates.filter(
    (c) => c.status === "processing" && c.visa_status !== "Returned" && (
      (c.tasheer_status === "Done" && c.wokala_status === "Paid" && !c.visa_status) ||
      c.visa_status === "Ready for embassy"
    ),
  );

  const visaReturned            = alertCandidates.filter((c) => c.status === "processing" && c.visa_status === "Returned");
  const visaWaitingReplacement  = alertCandidates.filter((c) => c.status === "processing" && c.visa_status === "Waiting Replacement");
  const tasheerDoneWokalaUnpaid = alertCandidates.filter((c) => c.status === "processing" && c.tasheer_status === "Done" && c.wokala_status === "Unpaid");
  const tasheerOverdue          = alertCandidates.filter((c) => {
    if (c.tasheer_status !== "Booked" || !c.tasheer_date) return false;
    return new Date(c.tasheer_date + "T00:00:00") < today;
  });
  const passportNotAccepted = alertCandidates.filter((c) => c.status === "processing" && c.tasheer_status === "Ready");
  const ticketReady         = alertCandidates.filter((c) => c.ticket_status === "Ready");
  const arrivalCityMissing  = alertCandidates.filter((c) => c.status === "processing" && !c.arrival_city);

  // ── Data & Misc sections ─────────────────────────────────────────────────────
  const unfilledLmis  = alertCandidates.filter((c) => c.status === "processing" && c.unfilled_lmis && c.unfilled_lmis.trim() !== "");
  const deletePending = alertCandidates.filter((c) => !!(c as any).delete_reason);
  const fitLmisNotTested  = alertCandidates.filter((c) => c.status === "processing" && c.medical_status === "Fit" && c.coc_status === "Done" && (!c.lmis_status || c.lmis_status === "Not tested"));
  const lmisDraftImported = alertCandidates.filter((c) => c.status === "processing" && (c.lmis_status === "Draft" || c.lmis_status === "Imported") && !(c as any).lmis_id_url);

  const cvOverdue = alertCandidates.filter((c) => {
    if (!c.cv_sent_to || c.selected_by || !c.cv_sent_date) return false;
    const days = Math.floor((today.getTime() - new Date(c.cv_sent_date + "T00:00:00").getTime()) / 86_400_000);
    return days >= managerCvThreshold;
  });

  const hasAlerts = cocNo.length > 0 || cocPlaced.length > 0 || medicalNotFit.length > 0 ||
    cocDoneNotFit.length > 0 || medicalExpired.length > 0 || unfilledLmis.length > 0 ||
    ticketNotBooked.length > 0 || ticketReady.length > 0 || arrivalCityMissing.length > 0 ||
    visaReady.length > 0 || visaReturned.length > 0 ||
    tasheerDoneWokalaUnpaid.length > 0 || passportNotAccepted.length > 0 ||
    cvOverdue.length > 0 || tasheerOverdue.length > 0 || fitLmisNotTested.length > 0 ||
    lmisDraftImported.length > 0 || noMedical5Days.length > 0 || noTasheer10Days.length > 0 ||
    visaWaitingReplacement.length > 0 || deletePending.length > 0;

  return (
    <>
    <div className="space-y-6 mx-[79.6px]">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <Button asChild size="sm" className="gap-2 text-xs h-8 rounded-none">
          <Link to="/manager/candidates">
            <UserPlus className="h-4 w-4" /> Manage Candidates
          </Link>
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-2">
        {STATUS_CONFIG.map((s) => {
          const count = counts[s.key];
          const Icon = s.icon;
          return (
            <div key={s.key} className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-none", s.bg)}>
              <div className={cn("h-7 w-7 rounded-none grid place-items-center shrink-0", s.icon_bg)}>
                <Icon className={cn("h-3.5 w-3.5", s.icon_color)} />
              </div>
              <div className="min-w-0">
                <span className={cn("text-lg font-bold leading-tight", s.value_color)}>{count}</span>
                <p className="text-[11px] text-foreground/70 font-medium truncate">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alert sections */}
      {hasAlerts && (
        <div className="space-y-5">
          {/* COMPLIANCE & RECRUITMENT */}
          {(noMedical5Days.length > 0 || noTasheer10Days.length > 0 || cocNo.length > 0 || cocPlaced.length > 0 || medicalNotFit.length > 0 || cocDoneNotFit.length > 0 || medicalExpired.length > 0) && (
            <div className="border border-border rounded-none overflow-hidden">
              <div className="px-3 py-2 bg-muted/20 border-b border-border">
                <p className="text-sm font-bold text-foreground uppercase tracking-widest">Compliance & Recruitment</p>
              </div>
              <div className="divide-y divide-border">
                <AlertSection icon={Stethoscope} title="Warning No Medical — 5+ Days in Processing" iconColor="text-red-600 dark:text-red-400" pillKey="medical" candidates={noMedical5Days} onUpdateField={handleUpdateField}
                  exportCols={[...BASE, { key: "contract_date", label: "Contract Date" }, { key: "office", label: "Office" }, { key: "selected_by", label: "Selected By" }]}
                  renderBadge={(c) => c.contract_date ? (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                      {daysSince(c.contract_date)}d
                    </span>
                  ) : null}
                  renderCardAction={(c) => (
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 text-[12px] px-2 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => {
                          handleUpdateField(c.id, "medical_status", "Fit");
                          handleUpdateField(c.id, "medical_date", new Date().toISOString().split("T")[0]);
                        }}>
                        Fit
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 text-[12px] px-2 rounded-none text-red-600 border-red-300 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                        onClick={() => {
                          handleUpdateField(c.id, "status", "canceled");
                          navigate({ to: "/manager/candidates", search: { tab: "canceled" } });
                        }}>
                        Cancel
                      </Button>
                    </div>
                  )} />
                <AlertSection icon={AlertTriangle} title="Warning No Tasheer — 10+ Days in Processing" iconColor="text-violet-600 dark:text-violet-400" pillKey="tasheer" candidates={noTasheer10Days} onUpdateField={handleUpdateField}
                  exportCols={[...BASE, { key: "contract_date", label: "Contract Date" }, { key: "office", label: "Office" }, { key: "selected_by", label: "Selected By" }]}
                  renderBadge={(c) => c.contract_date ? (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                      {daysSince(c.contract_date)}d
                    </span>
                  ) : null}
                  renderCardAction={(c) => (
                    <Button size="sm" variant="outline" className="h-6 text-[12px] px-2 rounded-none text-red-600 border-red-300 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                      onClick={() => {
                        handleUpdateField(c.id, "status", "canceled");
                        navigate({ to: "/manager/candidates", search: { tab: "canceled" } });
                      }}>
                      Suggest Cancel
                    </Button>
                  )} />
                <AlertSection icon={FileCheck} title="COC — No" iconColor="text-orange-600 dark:text-orange-400" pillKey="coc" candidates={cocNo} onUpdateField={handleUpdateField}
                  exportCols={[{ key: "full_name", label: "Full Name" }, { key: "passport_number", label: "Passport No." }, { key: "coc_status", label: "COC Status" }, { key: "labour_id", label: "Labour ID" }, { key: "narrative", label: "Narrative" }, { key: "narrative_phone", label: "Narrative Phone" }]}
                  renderBadge={(c) => (
                    <div className="text-right">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300">No</span>
                      {(c as any).coc_booked_date && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Booked: {new Date((c as any).coc_booked_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}</p>
                      )}
                    </div>
                  )}
                  renderCardAction={(c) => (
                    <CocBookButton candidate={c} onConfirm={(status, date) => {
                      handleUpdateField(c.id, "coc_status", status);
                      if (date) handleUpdateField(c.id, "coc_booked_date", date);
                    }} />
                  )} />
                <AlertSection icon={FileCheck} title="COC — Placed" iconColor="text-violet-600 dark:text-violet-400" pillKey="coc" candidates={cocPlaced} onUpdateField={handleUpdateField}
                  exportCols={[{ key: "full_name", label: "Full Name" }, { key: "passport_number", label: "Passport No." }, { key: "coc_status", label: "COC Status" }, { key: "labour_id", label: "Labour ID" }, { key: "office", label: "Office" }, { key: "narrative", label: "Narrative" }, { key: "narrative_phone", label: "Narrative Phone" }]}
                  renderBadge={(c) => (
                    <div className="text-right">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">Placed</span>
                      {(c as any).coc_booked_date && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Booked: {new Date((c as any).coc_booked_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}</p>
                      )}
                    </div>
                  )}
                  renderCardAction={(c) => (
                    <CocBookButton candidate={c} onConfirm={(status, date) => {
                      handleUpdateField(c.id, "coc_status", status);
                      if (date) handleUpdateField(c.id, "coc_booked_date", date);
                    }} />
                  )} />
                <AlertSection icon={Stethoscope} title="Medical — Not Fit" iconColor="text-red-600 dark:text-red-400" pillKey="medical" candidates={medicalNotFit} onUpdateField={handleUpdateField}
                  exportCols={[...BASE, { key: "medical_status", label: "Medical Status" }, { key: "medical_date", label: "Medical Date" }, { key: "coc_status", label: "COC Status" }, { key: "office", label: "Office" }]}
                  renderBadge={(c) => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">{c.medical_status}</span>}
                  renderCardAction={(c) => (
                    <MedicalBookButton candidateName={c.full_name}
                      onConfirm={(date) => {
                        handleUpdateField(c.id, "medical_date", date);
                        handleUpdateField(c.id, "medical_status", "Booked");
                      }} />
                  )} />
                <AlertSection icon={Stethoscope} title="COC Done — Medical Not Fit" iconColor="text-fuchsia-600 dark:text-fuchsia-400" pillKey="medical" candidates={cocDoneNotFit} onUpdateField={handleUpdateField}
                  exportCols={[...BASE, { key: "coc_status", label: "COC Status" }, { key: "medical_status", label: "Medical Status" }, { key: "medical_date", label: "Medical Date" }]}
                  renderBadge={(c) => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">{c.medical_status}</span>}
                  renderCardAction={(c) => (
                    <MedicalBookButton candidateName={c.full_name}
                      onConfirm={(date) => {
                        handleUpdateField(c.id, "medical_date", date);
                        handleUpdateField(c.id, "medical_status", "Booked");
                      }} />
                  )} />
                <AlertSection icon={CalendarX} title="Medical — Expired" iconColor="text-rose-600 dark:text-rose-400" pillKey="medexp" candidates={medicalExpired} onUpdateField={handleUpdateField}
                  exportCols={[{ key: "full_name", label: "Full Name" }, { key: "passport_number", label: "Passport No." }, { key: "medical_status", label: "Medical Status" }, { key: "narrative", label: "Narrative" }, { key: "narrative_phone", label: "Narrative Phone" }]}
                  renderBadge={(c) => (
                    <div className="text-right">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">Expired</span>
                      {c.medical_date && <p className="text-[10px] text-muted-foreground mt-0.5">{daysSince(c.medical_date)}d ago</p>}
                    </div>
                  )}
                  renderCardAction={(c) => (
                    <MedicalBookButton candidateName={c.full_name}
                      onConfirm={(date) => {
                        handleUpdateField(c.id, "medical_date", date);
                        handleUpdateField(c.id, "medical_status", "Booked");
                      }} />
                  )} />
              </div>
            </div>
          )}

          {/* LOGISTICS & DEPLOYMENT */}
          {(ticketNotBooked.length > 0 || ticketReady.length > 0 || arrivalCityMissing.length > 0 || visaReady.length > 0 || visaReturned.length > 0 || visaWaitingReplacement.length > 0 || tasheerOverdue.length > 0 || tasheerDoneWokalaUnpaid.length > 0 || passportNotAccepted.length > 0) && (
            <div className="border border-border rounded-none overflow-hidden">
              <div className="px-3 py-2 bg-muted/20 border-b border-border">
                <p className="text-sm font-bold text-foreground uppercase tracking-widest">Logistics & Deployment</p>
              </div>
              <div className="divide-y divide-border">
                <AlertSection icon={Ticket} title="Ticket Not Booked — Over 20 Days" iconColor="text-violet-600 dark:text-violet-400" pillKey="ticket" candidates={ticketNotBooked} onUpdateField={handleUpdateField}
                  exportCols={[...BASE, { key: "ticket_status", label: "Ticket" }, { key: "contract_date", label: "Contract Date" }, { key: "arrival_city", label: "Arrival City" }, { key: "office", label: "Office" }]}
                  renderBadge={(c) => c.contract_date ? <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">{daysSince(c.contract_date)}d since contract</span> : null}
                  renderCardAction={(c) => (
                    <TicketBookButton candidateName={c.full_name}
                      onConfirm={(date) => {
                        handleUpdateField(c.id, "ticket_date", date);
                        handleUpdateField(c.id, "ticket_status", "Booked");
                      }} />
                  )} />
                <AlertSection icon={Ticket} title="Ticket Ready" iconColor="text-violet-600 dark:text-violet-400" pillKey="ticket" candidates={ticketReady} onUpdateField={handleUpdateField}
                  exportCols={[{ key: "full_name", label: "Full Name" }, { key: "passport_number", label: "Passport No." }, { key: "ticket_status", label: "Ticket" }, { key: "ticket_date", label: "Ticket Date" }, { key: "arrival_city", label: "Arrival City" }, { key: "visa_status", label: "Visa Status" }, { key: "coc_status", label: "Coc Status" }, { key: "narrative", label: "Narrative" }, { key: "labour_id", label: "Labour Id" }, { key: "narrative_phone", label: "Narrative Phone" }]}
                  renderBadge={() => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">Ready</span>}
                  renderCardAction={(c) => (
                    <TicketBookButton candidateName={c.full_name}
                      onConfirm={(date) => {
                        handleUpdateField(c.id, "ticket_date", date);
                        handleUpdateField(c.id, "ticket_status", "Booked");
                      }} />
                  )} />
                <AlertSection icon={MapPin} title="Arrival City Not Set" iconColor="text-cyan-600 dark:text-cyan-400" pillKey="arrival" candidates={arrivalCityMissing} onUpdateField={handleUpdateField}
                  exportCols={[{ key: "full_name", label: "Full Name" }, { key: "passport_number", label: "Passport No." }, { key: "arrival_city", label: "Arrival City" }, { key: "ticket_status", label: "Ticket" }, { key: "office", label: "Office" }]}
                  renderCardAction={(c) => (
                    <Select onValueChange={(v) => handleUpdateField(c.id, "arrival_city", v)}>
                      <SelectTrigger className="h-7 text-xs rounded-none w-[110px]">
                        <SelectValue placeholder="Set City" />
                      </SelectTrigger>
                      <SelectContent>
                        {["Riyadh", "Jeddah", "Dammam", "Mecca", "Medina", "Taif", "Khobar", "Abha"].map((city) => (
                          <SelectItem key={city} value={city}>{city}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )} />
                <AlertSection icon={BadgeCheck} title="Ready for Embassy Visa" iconColor="text-emerald-600 dark:text-emerald-400" pillKey="visaready" candidates={visaReady} onUpdateField={handleUpdateField}
                  exportCols={[{ key: "full_name", label: "Full Name" }, { key: "passport_number", label: "Passport No." }, { key: "visa_status", label: "Visa Status" }, { key: "tasheer_status", label: "Tasheer" }, { key: "wokala_status", label: "Wokala" }]}
                  renderBadge={(c) => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">{c.visa_status === "Ready for embassy" ? "Ready" : "Auto"}</span>}
                  renderCardAction={(c) => (
                    <Button size="sm" variant="outline" className="rounded-none text-xs h-7 px-2"
                      onClick={() => handleUpdateField(c.id, "visa_status", "Sent to Embassy")}>
                      Sent to Embassy
                    </Button>
                  )} />
<AlertSection icon={AlertTriangle} title="Tasheer Overdue — Booked Date Passed" iconColor="text-amber-600 dark:text-amber-400" pillKey="tasheer" candidates={tasheerOverdue} onUpdateField={handleUpdateField}
                  exportCols={[{ key: "full_name", label: "Full Name" }, { key: "passport_number", label: "Passport No." }, { key: "tasheer_status", label: "Tasheer" }, { key: "tasheer_date", label: "Tasheer Date" }, { key: "wokala_status", label: "Wokala" }]}
                  renderBadge={(c) => c.tasheer_date ? <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">{daysSince(c.tasheer_date)}d overdue</span> : null}
                  renderCardAction={(c) => (
                    <Button size="sm" className="h-6 text-[12px] px-2 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleUpdateField(c.id, "tasheer_status", "Done")}>
                      Done
                    </Button>
                  )} />
                <AlertSection icon={AlertTriangle} title="Tasheer Done — Wokala Unpaid" iconColor="text-violet-600 dark:text-violet-400" pillKey="tasheer" candidates={tasheerDoneWokalaUnpaid} onUpdateField={handleUpdateField}
                  exportCols={[{ key: "full_name", label: "Full Name" }, { key: "passport_number", label: "Passport No." }, { key: "tasheer_status", label: "Tasheer" }, { key: "tasheer_date", label: "Tasheer Date" }, { key: "wokala_status", label: "Wokala" }]}
                  renderBadge={() => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">Unpaid</span>}
                  renderCardAction={(c) => (
                    <Button size="sm" variant="outline" className="rounded-none text-xs h-7 px-2"
                      onClick={() => handleUpdateField(c.id, "wokala_status", "Paid")}>
                      Mark Paid
                    </Button>
                  )} />
                <AlertSection icon={XCircle} title="Tasheer — Ready" iconColor="text-red-600 dark:text-red-400" pillKey="tasheer" candidates={passportNotAccepted} onUpdateField={handleUpdateField}
                  exportCols={[...BASE, { key: "tasheer_status", label: "Tasheer" }, { key: "passport_number", label: "Passport No." }, { key: "office", label: "Office" }]}
                  renderBadge={() => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">Ready</span>}
                  renderCardAction={(c) => (
                    <Button size="sm" className="h-6 text-[12px] px-2 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => {
                        handleUpdateField(c.id, "passport_accepted", "true");
                        handleUpdateField(c.id, "tasheer_status", "Done");
                        handleUpdateField(c.id, "visa_status", "Ready for embassy");
                      }}>
                      Yes
                    </Button>
                  )} />
                <AlertSection icon={RotateCcw} title="Visa Returned" iconColor="text-rose-600 dark:text-rose-400" pillKey="visareturn" candidates={visaReturned} onUpdateField={handleUpdateField}
                  exportCols={[...BASE, { key: "visa_status", label: "Visa Status" }, { key: "remark", label: "Remark" }, { key: "musaned_status", label: "Country" }]}
                  renderBadge={() => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">Returned</span>}
                  renderCardAction={(c) => (
                    <Button size="sm" variant="outline" className="rounded-none text-xs h-7 px-2"
                      onClick={() => handleUpdateField(c.id, "visa_status", "Waiting Replacement")}>
                      Replacement
                    </Button>
                  )} />
                <AlertSection icon={AlertTriangle} title="Visa — Waiting Replacement" iconColor="text-amber-600 dark:text-amber-400" pillKey="waitreplace" candidates={visaWaitingReplacement} onUpdateField={handleUpdateField}
                  exportCols={[...BASE, { key: "visa_status", label: "Visa Status" }, { key: "musaned_status", label: "Country" }, { key: "office", label: "Office" }, { key: "passport_number", label: "Passport No." }]}
                  renderBadge={() => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">Waiting</span>}
                  renderCardAction={(c) => (
                    <Button size="sm" variant="outline" className="rounded-none text-xs h-7 px-2 border-amber-400 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20"
                      onClick={() => { setReplacePending(c); setReplaceReason("Replacement sent"); setReplaceNotes(""); }}>
                      Pending Deletion
                    </Button>
                  )} />
              </div>
            </div>
          )}

          {/* PENDING DELETION */}
          {deletePending.length > 0 && (
            <div className="border border-red-300 dark:border-red-800 rounded-none overflow-hidden">
              <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-300 dark:border-red-800">
                <p className="text-sm font-bold text-red-700 dark:text-red-400 uppercase tracking-widest">Pending Deletion</p>
              </div>
              <div className="divide-y divide-border">
                <AlertSection icon={Trash2} title="Deletion Requested" iconColor="text-red-600 dark:text-red-400" pillKey="deletepending" candidates={deletePending} onUpdateField={handleUpdateField}
                  exportCols={[...BASE, { key: "delete_reason", label: "Delete Reason" }, { key: "status", label: "Status" }]}
                  renderBadge={(c) => (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 max-w-[140px] truncate block">
                      {(c as any).delete_reason}
                    </span>
                  )}
                  renderCardAction={(c) => (
                    <div className="flex gap-1">
                      <Button size="sm" variant="destructive" className="h-6 text-[12px] px-2 rounded-none"
                        disabled={fieldMut.isPending}
                        onClick={() => {
                          handleUpdateField(c.id, "status", "canceled");
                          handleUpdateField(c.id, "delete_reason", null);
                        }}>
                        Confirm
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 text-[12px] px-2 rounded-none"
                        onClick={() => handleUpdateField(c.id, "delete_reason", null)}>
                        Cancel
                      </Button>
                    </div>
                  )} />
              </div>
            </div>
          )}

          {/* DATA & MISC */}
          {(cvOverdue.length > 0 || unfilledLmis.length > 0 || fitLmisNotTested.length > 0 || lmisDraftImported.length > 0) && (
            <div className="border border-border rounded-none overflow-hidden">
              <div className="px-3 py-2 bg-muted/20 border-b border-border">
                <p className="text-sm font-bold text-foreground uppercase tracking-widest">Data & Misc</p>
              </div>
              <div className="divide-y divide-border">
                <AlertSection icon={Send} title="CV Sent — No Selection" iconColor="text-teal-600 dark:text-teal-400" pillKey="cvoverdue" candidates={cvOverdue} onUpdateField={handleUpdateField}
                  exportCols={[...BASE, { key: "cv_sent_to", label: "CV Sent To" }, { key: "cv_sent_date", label: "CV Sent Date" }, { key: "musaned_status", label: "Country" }]}
                  renderBadge={(c) => c.cv_sent_date ? <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">{Math.floor((today.getTime() - new Date(c.cv_sent_date + "T00:00:00").getTime()) / 86_400_000)}d ago</span> : null}
                  renderCardAction={(c) => (
                    <Button size="sm" variant="outline" className="rounded-none text-xs h-7 px-2"
                      onClick={() => handleUpdateField(c.id, "cv_sent_to", null)}>
                      Recall CV
                    </Button>
                  )} />
                <AlertSection icon={Stethoscope} title="Medical Fit — LMIS Not Tested" iconColor="text-teal-600 dark:text-teal-400" pillKey="fitlmis" candidates={fitLmisNotTested} onUpdateField={handleUpdateField}
                  exportCols={[{ key: "full_name", label: "Full Name" }, { key: "passport_number", label: "Passport No." }, { key: "medical_status", label: "Medical Status" }, { key: "coc_status", label: "COC Status" }, { key: "lmis_status", label: "LMIS" }]}
                  renderBadge={() => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">Not Tested</span>}
                  renderCardAction={(c) => (
                    <Button size="sm" variant="outline" className="rounded-none text-xs h-7 px-2"
                      onClick={() => handleUpdateField(c.id, "lmis_status", "Imported")}>
                      Start LMIS
                    </Button>
                  )} />
                <AlertSection icon={ClipboardList} title="LMIS file" iconColor="text-amber-600 dark:text-amber-400" pillKey="lmis" candidates={unfilledLmis} onUpdateField={handleUpdateField}
                  exportCols={[...BASE, { key: "lmis_status", label: "LMIS Status" }, { key: "unfilled_lmis", label: "Unfilled LMIS" }, { key: "labour_id", label: "Labour ID" }]}
                  renderBadge={(c) => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">{c.unfilled_lmis}</span>}
                  renderCardAction={(c) => (
                    <Button size="sm" variant="outline" className="rounded-none text-xs h-7 px-2"
                      onClick={() => handleUpdateField(c.id, "unfilled_lmis", "")}>
                      Mark Done
                    </Button>
                  )} />
                <AlertSection icon={Upload} title="LMIS Draft / Imported — Upload Files" iconColor="text-indigo-600 dark:text-indigo-400" pillKey="lmis" candidates={lmisDraftImported} onUpdateField={handleUpdateField}
                  exportCols={[...BASE, { key: "lmis_status", label: "LMIS Status" }, { key: "labour_id", label: "Labour ID" }, { key: "unfilled_lmis", label: "Unfilled LMIS" }]}
                  renderBadge={(c) => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">{c.lmis_status}</span>}
                  renderCardAction={(c) => (
                    <LmisUploadButton candidate={c}
                      onUpdate={(field, value) => handleUpdateField(c.id, field, value)} />
                  )} />
              </div>
            </div>
          )}

        </div>
      )}
    </div>
    {replacePending && (
      <Dialog open onOpenChange={(o) => { if (!o) setReplacePending(null); }}>
        <DialogContent className="max-w-sm rounded-none">
          <DialogHeader><DialogTitle>Replacement Reason</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Mark <strong>{replacePending.full_name}</strong> for deletion and explain why they are being replaced.
          </p>
          <div className="space-y-3 py-1">
            <Select value={replaceReason} onValueChange={setReplaceReason}>
              <SelectTrigger className="rounded-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Replacement sent">Replacement sent</SelectItem>
                <SelectItem value="Visa rejected — replacement">Visa rejected — replacement</SelectItem>
                <SelectItem value="Medical failed — replacement">Medical failed — replacement</SelectItem>
                <SelectItem value="Candidate refused — replacement">Candidate refused — replacement</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Additional notes (optional)"
              value={replaceNotes}
              onChange={(e) => setReplaceNotes(e.target.value)}
              className="rounded-none"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-none" onClick={() => setReplacePending(null)}>Cancel</Button>
            <Button variant="destructive" className="rounded-none" onClick={() => {
              handleUpdateField(replacePending.id, "status", "canceled");
              setReplacePending(null);
            }}>
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    {embassyOverwrite && (() => {
      const c = candidates.find((c) => c.id === embassyOverwrite);
      return c ? (
        <Dialog open onOpenChange={(o) => { if (!o) setEmbassyOverwrite(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Overwrite Embassy Date?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Embassy date for <strong>{c.full_name}</strong> is already set to{" "}
              <strong>{new Date((c as any).embassy_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</strong>.
              Replace with today's date?
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEmbassyOverwrite(null)}>No, keep existing</Button>
              <Button onClick={() => { fieldMut.mutate({ id: embassyOverwrite, field: "embassy_date", value: new Date().toISOString().split("T")[0] }); setEmbassyOverwrite(null); }}>
                Yes, update to today
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null;
    })()}
    </>
  );
}
