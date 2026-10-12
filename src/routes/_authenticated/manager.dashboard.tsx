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
import { cn, calcAge } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import { updateCandidateField, deleteCandidate, logFlightReadiness, getCandidates } from "@/lib/candidates.functions";

type Candidate = Database["public"]["Tables"]["candidates"]["Row"];

export const Route = createFileRoute("/_authenticated/manager/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Staff-Flow" }] }),
  component: ManagerDashboard,
});

// ─── Stat cards ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = [
  { key: "available" as const, label: "Available", icon: Users,
    bg: "bg-emerald-50 dark:bg-emerald-950/40", icon_bg: "bg-emerald-100 dark:bg-emerald-900/60",
    icon_color: "text-emerald-600 dark:text-emerald-400", value_color: "text-emerald-700 dark:text-emerald-300", bar: "bg-emerald-500" },
  { key: "processing" as const, label: "Processing", icon: Clock,
    bg: "bg-amber-50 dark:bg-amber-950/40", icon_bg: "bg-amber-100 dark:bg-amber-900/60",
    icon_color: "text-amber-600 dark:text-amber-400", value_color: "text-amber-700 dark:text-amber-300", bar: "bg-amber-500" },
  { key: "arrived" as const, label: "Arrived", icon: CheckCircle2,
    bg: "bg-blue-50 dark:bg-blue-950/40", icon_bg: "bg-blue-100 dark:bg-blue-900/60",
    icon_color: "text-blue-600 dark:text-blue-400", value_color: "text-blue-700 dark:text-blue-300", bar: "bg-blue-500" },
  { key: "canceled" as const, label: "Canceled", icon: XCircle,
    bg: "bg-red-50 dark:bg-red-950/40", icon_bg: "bg-red-100 dark:bg-red-900/60",
    icon_color: "text-red-600 dark:text-red-400", value_color: "text-red-700 dark:text-red-300", bar: "bg-red-500" },
  { key: "returned" as const, label: "Returned", icon: RotateCcw,
    bg: "bg-orange-50 dark:bg-orange-950/40", icon_bg: "bg-orange-100 dark:bg-orange-900/60",
    icon_color: "text-orange-600 dark:text-orange-400", value_color: "text-orange-700 dark:text-orange-300", bar: "bg-orange-500" },
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
  cvlongoverdue: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  fitlmis:   "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
  arrival:   "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
};

const ALERT_ICON_BG: Record<string, string> = {
  coc:          "bg-orange-50 dark:bg-orange-900/20",
  medical:      "bg-red-50 dark:bg-red-900/20",
  medexp:       "bg-rose-50 dark:bg-rose-900/20",
  lmis:         "bg-amber-50 dark:bg-amber-900/20",
  ticket:       "bg-violet-50 dark:bg-violet-900/20",
  embassy:      "bg-sky-50 dark:bg-sky-900/20",
  visaready:    "bg-emerald-50 dark:bg-emerald-900/20",
  visareturn:   "bg-rose-50 dark:bg-rose-900/20",
  waitreplace:  "bg-amber-50 dark:bg-amber-900/20",
  deletepending:"bg-red-50 dark:bg-red-900/20",
  tasheer:      "bg-violet-50 dark:bg-violet-900/20",
  cvoverdue:    "bg-teal-50 dark:bg-teal-900/20",
  cvlongoverdue:"bg-rose-50 dark:bg-rose-900/20",
  fitlmis:      "bg-teal-50 dark:bg-teal-900/20",
  arrival:      "bg-cyan-50 dark:bg-cyan-900/20",
};

// ─── Excel export ────────────────────────────────────────────────────────────
type ExportCol = { key: string; label: string };
const BASE: ExportCol[] = [
  { key: "full_name",       label: "Full Name" },
  { key: "passport_number", label: "Passport No." },
];

// Green color scheme — matches "Download Excel for Ticket" in action-dialog
const GREEN_HDR  = "16a34a"; // green-600 — all headers
const GREEN_NUM  = "4ade80"; // green-400 — number data cells
const GREEN_DARK = "14532d"; // green-900 — number cell text & borders
const WHITE      = "FFFFFF";

async function downloadCandidatesExcel(candidates: Candidate[], title: string, cols: ExportCol[]) {
  const XLSX = await import("xlsx-js-style");
  const sc = (v: string | number, s: object) => ({ v, t: typeof v === "number" ? "n" : "s", s });
  const numCellBorder = { style: "thin", color: { rgb: GREEN_DARK } };

  const headerStyle = {
    fill: { fgColor: { rgb: GREEN_HDR } },
    font: { bold: true, color: { rgb: WHITE }, sz: 11 },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  };
  const numHeaderStyle = {
    ...headerStyle,
    border: { top: numCellBorder, bottom: numCellBorder, left: numCellBorder, right: numCellBorder },
  };
  const makeNumCellStyle = () => ({
    fill: { fgColor: { rgb: GREEN_NUM } },
    font: { bold: true, color: { rgb: GREEN_DARK }, sz: 11 },
    alignment: { horizontal: "center", vertical: "center" },
    border: { top: numCellBorder, bottom: numCellBorder, left: numCellBorder, right: numCellBorder },
  });
  const dataCellStyle = {
    alignment: { vertical: "center", wrapText: false },
    font: { sz: 10 },
  };

  const headerRow = [
    sc("Number", numHeaderStyle),
    ...cols.map((c) => sc(c.label, headerStyle)),
  ];
  const dataRows = candidates.map((c, i) => [
    sc(i + 1, makeNumCellStyle()),
    ...cols.map((col) => {
      const v = (c as any)[col.key];
      return sc(v == null ? "" : String(v), dataCellStyle);
    }),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

  ws["!cols"] = ["Number", ...cols.map((c) => c.label)].map((h, i) => ({
    wch: i === 0 ? 9 : Math.max(
      h.length,
      ...dataRows.map((r) => String((r[i] as any)?.v ?? "").length),
      12,
    ),
  }));
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

// ─── Option constants ────────────────────────────────────────────────────────
const MEDICAL_OPTIONS    = ["Fit", "Booked", "Unfit", "No", "In progress", "Expired"];
const COC_OPTIONS        = ["Done", "No", "Booked", "Placed", "Yitazez", "Pending release"];
const OFFICE_OPTIONS     = ["Riyadh", "Jeddah", "Dammam", "Other"];
const PASSPORT_OPTIONS   = ["Original", "Scan"];
const TASHEER_OPTIONS    = ["No", "Booked", "Done", "Done without passport"];
const WOKALA_OPTIONS     = ["Paid", "Unpaid"];
const VISA_OPTIONS       = ["Ready for embassy", "Sent to Embassy", "Privately Sent", "Issued", "Visa canceled", "Arrived KSA", "Returned", "Waiting Replacement"];
const INSURANCE_OPTIONS  = ["Done", "Pending", "No", "Expired"];
const LMIS_OPTIONS       = ["No COC", "Not tested", "Placed", "Imported", "Checked", "Verified", "Draft", "Pending", "Issued", "Rejected"];
const TICKET_OPTIONS     = ["No", "Ready", "New Order", "Booked", "Exchange", "Urgent"];
const ARRIVAL_CITY_OPTIONS = ["RIYADH", "JEDDAH", "DAMMAM", "JOUF", "HAIL", "ABHA", "OTHERS"];
const STATUS_OPTIONS     = ["available", "processing", "arrived", "returned", "canceled"];

// ─── Inline editing helpers ──────────────────────────────────────────────────
function InlineSelect({ value, options, onSave }: { value: string; options: string[]; onSave: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="text-left rounded-none px-1 -mx-1 py-0.5 hover:bg-muted/60 hover:ring-1 hover:ring-border block min-w-[60px] text-[13px]">
        {value || <span className="text-muted-foreground">—</span>}
      </button>
    );
  }
  return (
    <div className="relative z-20">
      <div className="absolute top-0 left-0 bg-background border border-border shadow-md rounded-none min-w-[140px]">
        {options.map((opt) => (
          <button key={opt} type="button"
            className={cn("w-full text-left px-3 py-1.5 text-[13px] hover:bg-muted/60", opt === value && "bg-muted/40 font-semibold")}
            onMouseDown={() => { setOpen(false); if (opt !== value) onSave(opt); }}>
            {opt}
          </button>
        ))}
        <button type="button"
          className="w-full text-left px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-muted/60"
          onMouseDown={() => { setOpen(false); if (value) onSave(null); }}>
          Clear
        </button>
      </div>
      <div className="fixed inset-0 z-[-1]" onClick={() => setOpen(false)} />
    </div>
  );
}

function InlineText({ value, onSave, long }: { value: string; onSave: (v: string | null) => void; long?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <button type="button" onClick={() => { setDraft(value); setEditing(true); }}
        className={cn("text-left rounded-none px-1 -mx-1 py-0.5 hover:bg-muted/60 hover:ring-1 hover:ring-border min-w-[60px] block text-[13px]", long ? "whitespace-pre-wrap max-w-[260px]" : "whitespace-nowrap")}>
        {value || <span className="text-muted-foreground">—</span>}
      </button>
    );
  }
  return (
    <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); if (draft !== value) onSave(draft || null); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
        if (e.key === "Escape") { setDraft(value); setEditing(false); }
      }}
      className="rounded-none border border-primary bg-background px-1 py-0.5 text-[13px] outline-none min-w-[120px]" />
  );
}

function InlineDate({ value, onSave, showDays }: { value: string; onSave: (v: string | null) => void; showDays?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const fmt = (v: string) => v ? new Date(v + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "";
  const days = showDays && value ? Math.floor((Date.now() - new Date(value + "T00:00:00").getTime()) / 86_400_000) : null;
  if (!editing) {
    return (
      <button type="button" onClick={() => { setDraft(value); setEditing(true); }}
        className="text-left rounded-none px-1 -mx-1 py-0.5 hover:bg-muted/60 hover:ring-1 hover:ring-border min-w-[60px] block text-[13px]">
        {value ? fmt(value) : <span className="text-muted-foreground">—</span>}
        {days !== null && <span className="block text-[11px] text-muted-foreground mt-0.5">({days}d)</span>}
      </button>
    );
  }
  return (
    <input autoFocus type="date" value={draft} onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); if (draft !== value) onSave(draft || null); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
        if (e.key === "Escape") { setDraft(value); setEditing(false); }
      }}
      className="rounded-none border border-primary bg-background px-1 py-0.5 text-[13px] outline-none min-w-[110px]" />
  );
}

// ─── Candidate detail view (manager, sectioned + editable) ───────────────────
function ER({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="text-[13px] text-foreground">{children}</div>
    </div>
  );
}
function DS({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">{title}</h3>
      <div className="grid grid-cols-3 gap-x-6 gap-y-3">{children}</div>
    </div>
  );
}
function ManagerCandidateDetailView({ candidate, onUpdateField, countryOptions }: {
  candidate: Candidate;
  onUpdateField: (field: string, value: string | null) => void;
  countryOptions: string[];
}) {
  const statusStyles: Record<string, string> = {
    available: "bg-emerald-400 text-emerald-800", processing: "bg-amber-400 text-amber-800",
    arrived: "bg-blue-400 text-blue-800", canceled: "bg-red-400 text-red-800", returned: "bg-orange-400 text-orange-800",
  };
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 shrink-0">
          {candidate.photo_url && <AvatarImage src={candidate.photo_url} alt={candidate.full_name} />}
          <AvatarFallback className="text-sm rounded-none">{candidate.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base truncate">{candidate.full_name}</p>
          {candidate.candidate_code && <p className="text-xs font-mono text-muted-foreground">{candidate.candidate_code}</p>}
        </div>
        <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-none capitalize shrink-0", statusStyles[candidate.status] ?? "bg-muted text-muted-foreground")}>
          {candidate.status}
        </span>
      </div>

      {(candidate.photo_url || candidate.passport_scan_url) && (
        <div className="flex gap-3">
          {candidate.photo_url && (
            <div className="flex flex-col items-center gap-1">
              <img src={candidate.photo_url} alt="Photo" className="h-24 w-20 object-cover border border-border" />
              <span className="text-[10px] text-muted-foreground">Photo</span>
            </div>
          )}
          {candidate.passport_scan_url && (
            <div className="flex flex-col items-center gap-1">
              <img src={candidate.passport_scan_url} alt="Passport" className="h-24 w-20 object-cover border border-border" />
              <span className="text-[10px] text-muted-foreground">Passport Scan</span>
            </div>
          )}
        </div>
      )}

      <DS title="Personal">
        <ER label="Gender">{candidate.gender || "—"}</ER>
        <ER label="Religion">{candidate.religion || "—"}</ER>
        <ER label="Marital Status">{candidate.marital_status || "—"}</ER>
        <ER label="Birth Place">{candidate.birth_place || "—"}</ER>
        <ER label="Age">{String(calcAge(candidate.dob) ?? candidate.age ?? "—")}</ER>
        <ER label="Occupation"><InlineText value={candidate.occupation ?? ""} onSave={(v) => onUpdateField("occupation", v)} /></ER>
        <ER label="Living Town"><InlineText value={candidate.living_town ?? ""} onSave={(v) => onUpdateField("living_town", v)} /></ER>
      </DS>

      <DS title="Passport">
        <ER label="Passport Number">{candidate.passport_number || "—"}</ER>
        <ER label="Labour ID">{candidate.labour_id || "—"}</ER>
        <ER label="Passport Status"><InlineSelect value={candidate.passport_status ?? ""} options={PASSPORT_OPTIONS} onSave={(v) => onUpdateField("passport_status", v)} /></ER>
      </DS>

      <DS title="Status">
        <ER label="Availability"><InlineSelect value={candidate.status ?? ""} options={STATUS_OPTIONS} onSave={(v) => onUpdateField("status", v)} /></ER>
        <ER label="COC Status"><InlineSelect value={candidate.coc_status ?? ""} options={COC_OPTIONS} onSave={(v) => onUpdateField("coc_status", v)} /></ER>
        <ER label="Medical Status"><InlineSelect value={candidate.medical_status ?? ""} options={MEDICAL_OPTIONS} onSave={(v) => onUpdateField("medical_status", v)} /></ER>
        <ER label="Medical Date"><InlineDate value={candidate.medical_date ?? ""} onSave={(v) => onUpdateField("medical_date", v)} /></ER>
        <ER label="Country"><InlineSelect value={candidate.musaned_status ?? ""} options={countryOptions} onSave={(v) => onUpdateField("musaned_status", v)} /></ER>
        <ER label="Office"><InlineSelect value={candidate.office ?? ""} options={OFFICE_OPTIONS} onSave={(v) => onUpdateField("office", v)} /></ER>
        <ER label="Selected By"><InlineText value={candidate.selected_by ?? ""} onSave={(v) => onUpdateField("selected_by", v)} /></ER>
        <ER label="Contract Date"><InlineDate value={candidate.contract_date ?? ""} onSave={(v) => onUpdateField("contract_date", v)} showDays /></ER>
        <ER label="CV Sent To">{candidate.cv_sent_to || "—"}</ER>
        <ER label="Narrative"><InlineText value={candidate.narrative ?? ""} onSave={(v) => onUpdateField("narrative", v)} long /></ER>
      </DS>

      <DS title="Logistics">
        <ER label="Tasheer Status"><InlineSelect value={candidate.tasheer_status ?? ""} options={TASHEER_OPTIONS} onSave={(v) => onUpdateField("tasheer_status", v)} /></ER>
        <ER label="Tasheer Date"><InlineDate value={candidate.tasheer_date ?? ""} onSave={(v) => onUpdateField("tasheer_date", v)} /></ER>
        <ER label="Wokala Status"><InlineSelect value={candidate.wokala_status ?? ""} options={WOKALA_OPTIONS} onSave={(v) => onUpdateField("wokala_status", v)} /></ER>
        <ER label="Visa Status"><InlineSelect value={candidate.visa_status ?? ""} options={VISA_OPTIONS} onSave={(v) => onUpdateField("visa_status", v)} /></ER>
        <ER label="Ticket Status"><InlineSelect value={candidate.ticket_status ?? ""} options={TICKET_OPTIONS} onSave={(v) => onUpdateField("ticket_status", v)} /></ER>
        <ER label="Ticket Date"><InlineDate value={candidate.ticket_date ?? ""} onSave={(v) => onUpdateField("ticket_date", v)} /></ER>
        <ER label="Arrival City"><InlineSelect value={candidate.arrival_city ?? ""} options={ARRIVAL_CITY_OPTIONS} onSave={(v) => onUpdateField("arrival_city", v)} /></ER>
      </DS>

      <DS title="LMIS & Insurance">
        <ER label="LMIS Status"><InlineSelect value={candidate.lmis_status ?? ""} options={LMIS_OPTIONS} onSave={(v) => onUpdateField("lmis_status", v)} /></ER>
        <ER label="Insurance"><InlineSelect value={candidate.insurance_status ?? ""} options={INSURANCE_OPTIONS} onSave={(v) => onUpdateField("insurance_status", v)} /></ER>
      </DS>

      {(candidate.notes || candidate.remark) && (
        <DS title="Other">
          {candidate.notes && <div className="col-span-3"><ER label="Notes"><InlineText value={candidate.notes ?? ""} onSave={(v) => onUpdateField("notes", v)} long /></ER></div>}
          {candidate.remark && <div className="col-span-3"><ER label="Remark">{candidate.remark}</ER></div>}
        </DS>
      )}
    </div>
  );
}

// ─── Alert section ───────────────────────────────────────────────────────────
function AlertSection({
  icon: Icon, title, iconColor, pillKey, candidates, getNote, renderBadge, exportCols, onUpdateField, renderCardAction, countryOptions,
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
  countryOptions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewCandidate, setViewCandidate] = useState<Candidate | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  if (candidates.length === 0) return null;

  const statusSet = new Set(candidates.map((c) => c.status));
  const filtered = statusFilter === "all" ? candidates : candidates.filter((c) => c.status === statusFilter);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/25 transition-colors text-left group"
        onClick={() => { setOpen(true); setPage(1); }}
      >
        <div className={cn("h-8 w-8 rounded-none grid place-items-center shrink-0", ALERT_ICON_BG[pillKey] ?? "bg-muted/40")}>
          <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
        </div>
        <span className="flex-1 text-[13px] font-medium leading-snug truncate">{title}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("min-w-[2.25rem] text-center text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-none", ALERT_PILL[pillKey])}>
            {candidates.length}
          </span>
          <span
            role="button"
            title="Download Excel"
            className="p-1 text-muted-foreground hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); downloadCandidatesExcel(filtered, title, exportCols); }}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
        </div>
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
                  <p className="text-xs text-muted-foreground truncate">{[c.passport_number, c.narrative].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {renderCardAction?.(c)}
                  <button type="button" title="View candidate" onClick={() => setViewCandidate(c)}
                    className="p-1 rounded-none text-muted-foreground hover:text-primary hover:bg-muted/60 transition-colors shrink-0">
                    <FileText className="h-3.5 w-3.5" />
                  </button>
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

      <Dialog open={!!viewCandidate} onOpenChange={(o) => { if (!o) setViewCandidate(null); }}>
        <DialogContent className="max-w-2xl rounded-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {viewCandidate?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            {viewCandidate && (
              <ManagerCandidateDetailView
                candidate={viewCandidate}
                onUpdateField={(field, value) => onUpdateField(viewCandidate.id, field, value)}
                countryOptions={countryOptions}
              />
            )}
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

  const fetchCandidates = useServerFn(getCandidates);
  const { data: candidates = [] } = useQuery({
    queryKey: ["manager-candidates", user?.id],
    enabled: !!user,
    queryFn: () => fetchCandidates({}) as Promise<Candidate[]>,
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
      const { data, error } = await supabase.from("staff").select("id, name, role_title, status").eq("manager_id", user!.id).order("name");
      if (error) throw error;
      return data as { id: string; name: string; role_title: string | null; status: string }[];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["manager-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("cv_days_threshold, cv_page_requirements").eq("id", user!.id).maybeSingle();
      return data;
    },
  });
  const managerCvThreshold = profile?.cv_days_threshold ?? 7;
  const alertAfterDays = parseInt(((profile as any)?.cv_page_requirements as any)?.alert_after_days ?? "90") || 90;
  const countryOptions = assignCountries.map((c) => c.name);
  const [embassyOverwrite, setEmbassyOverwrite] = useState<string | null>(null);
  const [replacePending, setReplacePending] = useState<Candidate | null>(null);
  const todayKey = new Date().toISOString().split("T")[0];
  const [flightReminderOpen, setFlightReminderOpen] = useState(() => {
    try { return sessionStorage.getItem("flight-reminder-dismissed") !== todayKey; } catch { return true; }
  });
  const [replaceReason, setReplaceReason] = useState("Replacement sent");
  const [replaceNotes, setReplaceNotes] = useState("");

  const removeFn = useServerFn(deleteCandidate);
  const logFlightFn = useServerFn(logFlightReadiness);
  const fieldMut = useMutation({
    mutationFn: (vars: { id: string; field: string; value: string | null }) =>
      updateCandidateField({ data: vars as never }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["manager-candidates"] }),
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["manager-candidates"] }),
  });

  const handleUpdateField = (id: string, field: string, value: string | null) => {
    fieldMut.mutate({ id, field, value });
    if (field === "medical_status" && value !== "Fit" && value !== "Expired") {
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
    if (field === "ticket_status" && value === "No")
      fieldMut.mutate({ id, field: "ticket_date", value: null });
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

  const upcomingFlights = candidates.filter((c) => {
    if (c.ticket_status !== "Booked" || !c.ticket_date) return false;
    const daysUntil = Math.ceil((new Date(c.ticket_date + "T00:00:00").getTime() - today.getTime()) / 86_400_000);
    return daysUntil >= 0 && daysUntil <= 3;
  }).sort((a, b) => (a.ticket_date ?? "").localeCompare(b.ticket_date ?? ""));

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
    return days >= managerCvThreshold && days < alertAfterDays;
  });

  const cvLongOverdue = alertCandidates.filter((c) => {
    if (!c.cv_sent_to || c.selected_by || !c.cv_sent_date) return false;
    const days = Math.floor((today.getTime() - new Date(c.cv_sent_date + "T00:00:00").getTime()) / 86_400_000);
    return days >= alertAfterDays;
  });

  const hasAlerts = cocNo.length > 0 || cocPlaced.length > 0 || medicalNotFit.length > 0 ||
    cocDoneNotFit.length > 0 || medicalExpired.length > 0 || unfilledLmis.length > 0 ||
    ticketNotBooked.length > 0 || ticketReady.length > 0 || arrivalCityMissing.length > 0 ||
    visaReady.length > 0 || visaReturned.length > 0 ||
    tasheerDoneWokalaUnpaid.length > 0 || passportNotAccepted.length > 0 ||
    cvOverdue.length > 0 || cvLongOverdue.length > 0 || tasheerOverdue.length > 0 || fitLmisNotTested.length > 0 ||
    lmisDraftImported.length > 0 || noMedical5Days.length > 0 || noTasheer10Days.length > 0 ||
    visaWaitingReplacement.length > 0 || deletePending.length > 0;

  const weeklyAdded = candidates.filter((c) => {
    if (!c.created_at) return false;
    return Math.floor((today.getTime() - new Date(c.created_at).getTime()) / 86_400_000) < 7;
  }).length;
  const weeklyDeployments = candidates.filter((c) => {
    if (c.status !== "arrived" || !c.ticket_date) return false;
    const d = Math.floor((today.getTime() - new Date(c.ticket_date + "T00:00:00").getTime()) / 86_400_000);
    return d >= 0 && d < 7;
  }).length;
  const totalAlerts = [
    cocNo, cocPlaced, medicalNotFit, cocDoneNotFit, medicalExpired,
    noMedical5Days, noTasheer10Days, unfilledLmis, ticketNotBooked,
    ticketReady, arrivalCityMissing, visaReady, visaReturned,
    visaWaitingReplacement, tasheerDoneWokalaUnpaid, passportNotAccepted,
    cvOverdue, cvLongOverdue, tasheerOverdue, fitLmisNotTested, lmisDraftImported, deletePending,
  ].reduce((sum, arr) => sum + arr.length, 0);

  return (
    <>
    <div className="space-y-6 px-6 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <Button asChild size="sm" className="gap-2 text-xs h-8 rounded-none">
          <Link to="/manager/candidates">
            <UserPlus className="h-4 w-4" /> Manage Candidates
          </Link>
        </Button>
      </div>

      {/* ── Candidate Status Overview ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {STATUS_CONFIG.map((s) => {
          const count = counts[s.key];
          const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
          const Icon  = s.icon;
          return (
            <div key={s.key} className="relative border border-border bg-card rounded-none p-3 overflow-hidden">
              <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", s.bar)} />
              <div className="pl-2">
                <div className={cn("h-6 w-6 rounded-none grid place-items-center mb-2", s.icon_bg)}>
                  <Icon className={cn("h-3 w-3", s.icon_color)} />
                </div>
                <p className={cn("text-2xl font-bold leading-none tabular-nums", s.value_color)}>{count}</p>
                <p className="text-[11px] text-muted-foreground mt-1 font-medium">{s.label}</p>
                <div className="mt-2 h-0.5 bg-border/50 rounded-full overflow-hidden">
                  <div className={cn("h-full transition-all rounded-full", s.bar)} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{pct}% of {total}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming flights (inline) */}
      {upcomingFlights.length > 0 && (
        <div className="border border-primary/30 bg-primary/5 rounded-none overflow-hidden">
          <div className="px-4 py-2.5 border-b border-primary/20 flex items-center gap-2">
            <Ticket className="h-3.5 w-3.5 text-primary shrink-0" />
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Upcoming Flights — Next 3 Days</p>
          </div>
          <div className="divide-y divide-primary/10">
            {upcomingFlights.map((c) => {
              const daysUntil = Math.ceil((new Date(c.ticket_date! + "T00:00:00").getTime() - today.getTime()) / 86_400_000);
              return (
                <div key={c.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                  <span className="text-sm font-medium truncate">{c.full_name}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    {c.arrival_city && <span className="text-xs text-muted-foreground">{c.arrival_city}</span>}
                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(c.ticket_date! + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </span>
                    <span className={cn("text-[11px] font-semibold px-2 py-0.5",
                      daysUntil === 0 ? "bg-destructive/15 text-destructive" :
                      daysUntil === 1 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" :
                      "bg-primary/10 text-primary")}>
                      {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alert summary */}
      {hasAlerts && (
        <div className="flex items-center gap-2 px-4 py-2.5 border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {totalAlerts} alert{totalAlerts !== 1 ? "s" : ""} require attention — review sections below
          </p>
        </div>
      )}

      {/* Alert sections */}
      {hasAlerts && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {/* COMPLIANCE & RECRUITMENT */}
          {(noMedical5Days.length > 0 || noTasheer10Days.length > 0 || cocNo.length > 0 || cocPlaced.length > 0 || medicalNotFit.length > 0 || cocDoneNotFit.length > 0 || medicalExpired.length > 0) && (
            <div className="border border-border rounded-none overflow-hidden">
              <div className="px-4 py-2.5 bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-900/60 flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-widest text-red-700 dark:text-red-400">Compliance & Recruitment</p>
                <span className="ml-auto text-[11px] font-bold tabular-nums px-2.5 py-0.5 rounded-none bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                  {[noMedical5Days, noTasheer10Days, cocNo, cocPlaced, medicalNotFit, cocDoneNotFit, medicalExpired].reduce((sum, a) => sum + a.length, 0)}
                </span>
              </div>
              <div className="divide-y divide-border">
                <AlertSection icon={Stethoscope} title="Warning No Medical — 5+ Days in Processing" iconColor="text-red-600 dark:text-red-400" pillKey="medical" candidates={noMedical5Days} onUpdateField={handleUpdateField} countryOptions={countryOptions}
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
                <AlertSection icon={AlertTriangle} title="Warning No Tasheer — 10+ Days in Processing" iconColor="text-violet-600 dark:text-violet-400" pillKey="tasheer" candidates={noTasheer10Days} onUpdateField={handleUpdateField} countryOptions={countryOptions}
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
                <AlertSection icon={FileCheck} title="COC — No" iconColor="text-orange-600 dark:text-orange-400" pillKey="coc" candidates={cocNo} onUpdateField={handleUpdateField} countryOptions={countryOptions}
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
                <AlertSection icon={FileCheck} title="COC — Placed" iconColor="text-violet-600 dark:text-violet-400" pillKey="coc" candidates={cocPlaced} onUpdateField={handleUpdateField} countryOptions={countryOptions}
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
                <AlertSection icon={Stethoscope} title="Medical — Not Fit" iconColor="text-red-600 dark:text-red-400" pillKey="medical" candidates={medicalNotFit} onUpdateField={handleUpdateField} countryOptions={countryOptions}
                  exportCols={[...BASE, { key: "medical_status", label: "Medical Status" }, { key: "medical_date", label: "Medical Date" }, { key: "coc_status", label: "COC Status" }, { key: "office", label: "Office" }]}
                  renderBadge={(c) => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">{c.medical_status}</span>}
                  renderCardAction={(c) => (
                    <MedicalBookButton candidateName={c.full_name}
                      onConfirm={(date) => {
                        handleUpdateField(c.id, "medical_date", date);
                        handleUpdateField(c.id, "medical_status", "Booked");
                      }} />
                  )} />
                <AlertSection icon={Stethoscope} title="COC Done — Medical Not Fit" iconColor="text-fuchsia-600 dark:text-fuchsia-400" pillKey="medical" candidates={cocDoneNotFit} onUpdateField={handleUpdateField} countryOptions={countryOptions}
                  exportCols={[...BASE, { key: "coc_status", label: "COC Status" }, { key: "medical_status", label: "Medical Status" }, { key: "medical_date", label: "Medical Date" }]}
                  renderBadge={(c) => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">{c.medical_status}</span>}
                  renderCardAction={(c) => (
                    <MedicalBookButton candidateName={c.full_name}
                      onConfirm={(date) => {
                        handleUpdateField(c.id, "medical_date", date);
                        handleUpdateField(c.id, "medical_status", "Booked");
                      }} />
                  )} />
                <AlertSection icon={CalendarX} title="Medical — Expired" iconColor="text-rose-600 dark:text-rose-400" pillKey="medexp" candidates={medicalExpired} onUpdateField={handleUpdateField} countryOptions={countryOptions}
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
              <div className="px-4 py-2.5 bg-violet-50 dark:bg-violet-950/20 border-b border-violet-200 dark:border-violet-900/60 flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-widest text-violet-700 dark:text-violet-400">Logistics & Deployment</p>
                <span className="ml-auto text-[11px] font-bold tabular-nums px-2.5 py-0.5 rounded-none bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  {[ticketNotBooked, ticketReady, arrivalCityMissing, visaReady, visaReturned, visaWaitingReplacement, tasheerOverdue, tasheerDoneWokalaUnpaid, passportNotAccepted].reduce((sum, a) => sum + a.length, 0)}
                </span>
              </div>
              <div className="divide-y divide-border">
                <AlertSection icon={Ticket} title="Ticket Not Booked — Over 20 Days" iconColor="text-violet-600 dark:text-violet-400" pillKey="ticket" candidates={ticketNotBooked} onUpdateField={handleUpdateField} countryOptions={countryOptions}
                  exportCols={[...BASE, { key: "ticket_status", label: "Ticket" }, { key: "contract_date", label: "Contract Date" }, { key: "arrival_city", label: "Arrival City" }, { key: "office", label: "Office" }]}
                  renderBadge={(c) => c.contract_date ? <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">{daysSince(c.contract_date)}d since contract</span> : null}
                  renderCardAction={(c) => (
                    <TicketBookButton candidateName={c.full_name}
                      onConfirm={(date) => {
                        handleUpdateField(c.id, "ticket_date", date);
                        handleUpdateField(c.id, "ticket_status", "Booked");
                      }} />
                  )} />
                <AlertSection icon={Ticket} title="Ticket Ready" iconColor="text-violet-600 dark:text-violet-400" pillKey="ticket" candidates={ticketReady} onUpdateField={handleUpdateField} countryOptions={countryOptions}
                  exportCols={[{ key: "full_name", label: "Full Name" }, { key: "passport_number", label: "Passport No." }, { key: "ticket_status", label: "Ticket" }, { key: "ticket_date", label: "Ticket Date" }, { key: "arrival_city", label: "Arrival City" }, { key: "visa_status", label: "Visa Status" }, { key: "coc_status", label: "Coc Status" }, { key: "narrative", label: "Narrative" }, { key: "labour_id", label: "Labour Id" }, { key: "narrative_phone", label: "Narrative Phone" }]}
                  renderBadge={() => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">Ready</span>}
                  renderCardAction={(c) => (
                    <TicketBookButton candidateName={c.full_name}
                      onConfirm={(date) => {
                        handleUpdateField(c.id, "ticket_date", date);
                        handleUpdateField(c.id, "ticket_status", "Booked");
                      }} />
                  )} />
                <AlertSection icon={MapPin} title="Arrival City Not Set" iconColor="text-cyan-600 dark:text-cyan-400" pillKey="arrival" candidates={arrivalCityMissing} onUpdateField={handleUpdateField} countryOptions={countryOptions}
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
                <AlertSection icon={BadgeCheck} title="Ready for Embassy Visa" iconColor="text-emerald-600 dark:text-emerald-400" pillKey="visaready" candidates={visaReady} onUpdateField={handleUpdateField} countryOptions={countryOptions}
                  exportCols={[{ key: "full_name", label: "Full Name" }, { key: "passport_number", label: "Passport No." }, { key: "visa_status", label: "Visa Status" }, { key: "tasheer_status", label: "Tasheer" }, { key: "wokala_status", label: "Wokala" }]}
                  renderBadge={(c) => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">{c.visa_status === "Ready for embassy" ? "Ready" : "Auto"}</span>}
                  renderCardAction={(c) => (
                    <Button size="sm" variant="outline" className="rounded-none text-xs h-7 px-2"
                      onClick={() => handleUpdateField(c.id, "visa_status", "Sent to Embassy")}>
                      Sent to Embassy
                    </Button>
                  )} />
<AlertSection icon={AlertTriangle} title="Tasheer Overdue — Booked Date Passed" iconColor="text-amber-600 dark:text-amber-400" pillKey="tasheer" candidates={tasheerOverdue} onUpdateField={handleUpdateField} countryOptions={countryOptions}
                  exportCols={[{ key: "full_name", label: "Full Name" }, { key: "passport_number", label: "Passport No." }, { key: "tasheer_status", label: "Tasheer" }, { key: "tasheer_date", label: "Tasheer Date" }, { key: "wokala_status", label: "Wokala" }]}
                  renderBadge={(c) => c.tasheer_date ? <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">{daysSince(c.tasheer_date)}d overdue</span> : null}
                  renderCardAction={(c) => (
                    <Button size="sm" className="h-6 text-[12px] px-2 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleUpdateField(c.id, "tasheer_status", "Done")}>
                      Done
                    </Button>
                  )} />
                <AlertSection icon={AlertTriangle} title="Tasheer Done — Wokala Unpaid" iconColor="text-violet-600 dark:text-violet-400" pillKey="tasheer" candidates={tasheerDoneWokalaUnpaid} onUpdateField={handleUpdateField} countryOptions={countryOptions}
                  exportCols={[{ key: "full_name", label: "Full Name" }, { key: "passport_number", label: "Passport No." }, { key: "tasheer_status", label: "Tasheer" }, { key: "tasheer_date", label: "Tasheer Date" }, { key: "wokala_status", label: "Wokala" }]}
                  renderBadge={() => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">Unpaid</span>}
                  renderCardAction={(c) => (
                    <Button size="sm" variant="outline" className="rounded-none text-xs h-7 px-2"
                      onClick={() => handleUpdateField(c.id, "wokala_status", "Paid")}>
                      Mark Paid
                    </Button>
                  )} />
                <AlertSection icon={XCircle} title="Tasheer — Ready" iconColor="text-red-600 dark:text-red-400" pillKey="tasheer" candidates={passportNotAccepted} onUpdateField={handleUpdateField} countryOptions={countryOptions}
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
                <AlertSection icon={RotateCcw} title="Visa Returned" iconColor="text-rose-600 dark:text-rose-400" pillKey="visareturn" candidates={visaReturned} onUpdateField={handleUpdateField} countryOptions={countryOptions}
                  exportCols={[...BASE, { key: "visa_status", label: "Visa Status" }, { key: "remark", label: "Remark" }, { key: "musaned_status", label: "Country" }]}
                  renderBadge={() => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">Returned</span>}
                  renderCardAction={(c) => (
                    <Button size="sm" variant="outline" className="rounded-none text-xs h-7 px-2"
                      onClick={() => handleUpdateField(c.id, "visa_status", "Waiting Replacement")}>
                      Replacement
                    </Button>
                  )} />
                <AlertSection icon={AlertTriangle} title="Visa — Waiting Replacement" iconColor="text-amber-600 dark:text-amber-400" pillKey="waitreplace" candidates={visaWaitingReplacement} onUpdateField={handleUpdateField} countryOptions={countryOptions}
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

          {/* DATA & MISC column — Pending Deletion + Long-Overdue + Data & Misc */}
          <div className="space-y-4">

          {/* PENDING DELETION */}
          {deletePending.length > 0 && (
            <div className="border border-red-300 dark:border-red-800 rounded-none overflow-hidden">
              <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-300 dark:border-red-800">
                <p className="text-sm font-bold text-red-700 dark:text-red-400 uppercase tracking-widest">Pending Deletion</p>
              </div>
              <div className="divide-y divide-border">
                <AlertSection icon={Trash2} title="Deletion Requested" iconColor="text-red-600 dark:text-red-400" pillKey="deletepending" candidates={deletePending} onUpdateField={handleUpdateField} countryOptions={countryOptions}
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
          {cvLongOverdue.length > 0 && (
            <div className="border border-rose-300 dark:border-rose-800 rounded-none overflow-hidden">
              <div className="px-3 py-2 bg-rose-50/60 dark:bg-rose-950/40 border-b border-rose-300 dark:border-rose-800">
                <p className="text-sm font-bold text-rose-700 dark:text-rose-300 uppercase tracking-widest">⚠ Long-Overdue — No Selection</p>
                <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-0.5">CV sent {alertAfterDays}+ days ago with no office selection</p>
              </div>
              <div className="divide-y divide-border">
                <AlertSection icon={Send} title={`Unselected ≥ ${alertAfterDays} days`} iconColor="text-rose-600 dark:text-rose-400" pillKey="cvlongoverdue" candidates={cvLongOverdue} onUpdateField={handleUpdateField} countryOptions={countryOptions}
                  exportCols={[...BASE, { key: "cv_sent_to", label: "CV Sent To" }, { key: "cv_sent_date", label: "CV Sent Date" }, { key: "musaned_status", label: "Country" }]}
                  renderBadge={(c) => c.cv_sent_date ? <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">{Math.floor((today.getTime() - new Date(c.cv_sent_date + "T00:00:00").getTime()) / 86_400_000)}d ago</span> : null}
                />
              </div>
            </div>
          )}

          {(cvOverdue.length > 0 || unfilledLmis.length > 0 || fitLmisNotTested.length > 0 || lmisDraftImported.length > 0) && (
            <div className="border border-border rounded-none overflow-hidden">
              <div className="px-4 py-2.5 bg-teal-50 dark:bg-teal-950/20 border-b border-teal-200 dark:border-teal-900/60 flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-widest text-teal-700 dark:text-teal-400">Data & Misc</p>
                <span className="ml-auto text-[11px] font-bold tabular-nums px-2.5 py-0.5 rounded-none bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                  {[cvOverdue, fitLmisNotTested, unfilledLmis, lmisDraftImported].reduce((sum, a) => sum + a.length, 0)}
                </span>
              </div>
              <div className="divide-y divide-border">
                <AlertSection icon={Send} title="CV Sent — No Selection" iconColor="text-teal-600 dark:text-teal-400" pillKey="cvoverdue" candidates={cvOverdue} onUpdateField={handleUpdateField} countryOptions={countryOptions}
                  exportCols={[...BASE, { key: "cv_sent_to", label: "CV Sent To" }, { key: "cv_sent_date", label: "CV Sent Date" }, { key: "musaned_status", label: "Country" }]}
                  renderBadge={(c) => c.cv_sent_date ? <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">{Math.floor((today.getTime() - new Date(c.cv_sent_date + "T00:00:00").getTime()) / 86_400_000)}d ago</span> : null}
                  renderCardAction={(c) => (
                    <Button size="sm" variant="outline" className="rounded-none text-xs h-7 px-2"
                      onClick={() => handleUpdateField(c.id, "cv_sent_to", null)}>
                      Recall CV
                    </Button>
                  )} />
                <AlertSection icon={Stethoscope} title="Medical Fit — LMIS Not Tested" iconColor="text-teal-600 dark:text-teal-400" pillKey="fitlmis" candidates={fitLmisNotTested} onUpdateField={handleUpdateField} countryOptions={countryOptions}
                  exportCols={[{ key: "full_name", label: "Full Name" }, { key: "passport_number", label: "Passport No." }, { key: "medical_status", label: "Medical Status" }, { key: "coc_status", label: "COC Status" }, { key: "lmis_status", label: "LMIS" }]}
                  renderBadge={() => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">Not Tested</span>}
                  renderCardAction={(c) => (
                    <Button size="sm" variant="outline" className="rounded-none text-xs h-7 px-2"
                      onClick={() => handleUpdateField(c.id, "lmis_status", "Imported")}>
                      Start LMIS
                    </Button>
                  )} />
                <AlertSection icon={ClipboardList} title="LMIS file" iconColor="text-amber-600 dark:text-amber-400" pillKey="lmis" candidates={unfilledLmis} onUpdateField={handleUpdateField} countryOptions={countryOptions}
                  exportCols={[...BASE, { key: "lmis_status", label: "LMIS Status" }, { key: "unfilled_lmis", label: "Unfilled LMIS" }, { key: "labour_id", label: "Labour ID" }]}
                  renderBadge={(c) => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">{c.unfilled_lmis}</span>}
                  renderCardAction={(c) => (
                    <Button size="sm" variant="outline" className="rounded-none text-xs h-7 px-2"
                      onClick={() => handleUpdateField(c.id, "unfilled_lmis", "")}>
                      Mark Done
                    </Button>
                  )} />
                <AlertSection icon={Upload} title="LMIS Draft / Imported — Upload Files" iconColor="text-indigo-600 dark:text-indigo-400" pillKey="lmis" candidates={lmisDraftImported} onUpdateField={handleUpdateField} countryOptions={countryOptions}
                  exportCols={[...BASE, { key: "lmis_status", label: "LMIS Status" }, { key: "labour_id", label: "Labour ID" }, { key: "unfilled_lmis", label: "Unfilled LMIS" }]}
                  renderBadge={(c) => <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">{c.lmis_status}</span>}
                  renderCardAction={(c) => (
                    <LmisUploadButton candidate={c}
                      onUpdate={(field, value) => handleUpdateField(c.id, field, value)} />
                  )} />
              </div>
            </div>
          )}

          </div>{/* end DATA & MISC column */}

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
    {flightReminderOpen && upcomingFlights.length > 0 && (
      <Dialog open onOpenChange={(o) => {
        if (!o) {
          try { sessionStorage.setItem("flight-reminder-dismissed", todayKey); } catch {}
          setFlightReminderOpen(false);
        }
      }}>
        <DialogContent className="max-w-md rounded-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              ✈️ Upcoming Flights — Next 3 Days
            </DialogTitle>
            <p className="text-sm text-muted-foreground">Is she ready?</p>
          </DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {upcomingFlights.map((c) => {
              const daysUntil = Math.ceil((new Date(c.ticket_date! + "T00:00:00").getTime() - today.getTime()) / 86_400_000);
              return (
                <div key={c.id} className="flex items-center justify-between rounded-none border border-border px-3 py-2 text-sm">
                  <div>
                    <div className="font-semibold">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground">{c.arrival_city ?? "—"}</div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="font-mono text-xs">{new Date(c.ticket_date! + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</div>
                    <div className={`text-xs font-semibold ${daysUntil === 0 ? "text-red-600" : daysUntil === 1 ? "text-orange-500" : "text-amber-500"}`}>
                      {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              const ids = upcomingFlights.map((c) => c.id);
              logFlightFn({ data: { ids, answer: "Not ready" } });
              try { sessionStorage.setItem("flight-reminder-dismissed", todayKey); } catch {}
              setFlightReminderOpen(false);
            }}>No, not ready</Button>
            <Button onClick={() => {
              const ids = upcomingFlights.map((c) => c.id);
              logFlightFn({ data: { ids, answer: "Ready" } });
              try { sessionStorage.setItem("flight-reminder-dismissed", todayKey); } catch {}
              setFlightReminderOpen(false);
            }}>Yes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}
