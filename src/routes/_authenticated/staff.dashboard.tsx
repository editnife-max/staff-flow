import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import React, { useState } from "react";
import {
  Users, Clock, CheckCircle2, XCircle, RotateCcw,
  ChevronDown, ChevronUp, Stethoscope, FileCheck, ClipboardList, Ticket, FileText, CalendarX, Landmark, BadgeCheck, AlertTriangle, Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import { updateCandidateField } from "@/lib/candidates.functions";

type Candidate = Database["public"]["Tables"]["candidates"]["Row"];
type Status = "available" | "processing" | "arrived" | "canceled" | "returned";

export const Route = createFileRoute("/_authenticated/staff/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Staff-Flow" }] }),
  component: StaffDashboard,
});

// ─── Options ────────────────────────────────────────────────────────────────
const MEDICAL_OPTIONS    = ["Fit", "Booked", "Unfit", "No", "In progress", "Expired"];
const COC_OPTIONS        = ["Done", "No", "Booked", "Placed", "Yitazez", "Pending release"];
const MUSANED_OPTIONS: string[] = [];
const OFFICE_OPTIONS     = ["Riyadh", "Jeddah", "Dammam", "Other"];
const PASSPORT_OPTIONS   = ["Original", "Scan"];
const TASHEER_OPTIONS    = ["No", "Booked", "Done", "Ready"];
const WOKALA_OPTIONS     = ["Paid", "Unpaid"];
const VISA_OPTIONS       = ["Ready for embassy", "Sent to Embassy", "Privately Sent", "Issued", "Visa canceled", "Arrived KSA", "Returned", "Waiting Replacement"];
const INSURANCE_OPTIONS  = ["Done", "Pending", "No", "Expired"];
const LMIS_OPTIONS       = ["No COC", "Not tested", "Placed", "Imported", "Checked", "Verified", "Draft", "Pending", "Issued", "Rejected"];
const UNFILLED_LMIS_OPTIONS = ["INSU", "COC", "ID"];
const TICKET_OPTIONS     = ["No", "Ready", "New Order", "Booked", "Exchange", "Urgent"];
const ARRIVAL_CITY_OPTIONS = ["RIYADH", "JEDDAH", "DAMMAM", "JOUF", "HAIL", "ABHA", "OTHERS"];
const AVAILABILITY_OPTIONS: Status[] = ["available", "processing", "arrived", "returned", "canceled"];

const OPTION_COLORS: Record<string, string> = {
  "Fit":               "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  "Unfit":             "bg-red-100/50 text-[#181A27] dark:bg-red-900/40 dark:text-red-300",
  "In progress":       "bg-amber-100/50 text-[#181A27] dark:bg-amber-900/40 dark:text-amber-300",
  "Expired":           "bg-orange-100/50 text-[#181A27] dark:bg-orange-900/40 dark:text-orange-300",
  "No":                "bg-zinc-100/50 text-[#181A27] dark:bg-zinc-800 dark:text-zinc-400",
  "Done":              "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  "Booked":            "bg-blue-100/50 text-[#181A27] dark:bg-blue-900/40 dark:text-blue-300",
  "Placed":            "bg-violet-100/50 text-[#181A27] dark:bg-violet-900/40 dark:text-violet-300",
  "Yitazez":           "bg-orange-100/50 text-[#181A27] dark:bg-orange-900/40 dark:text-orange-300",
  "Pending release":   "bg-amber-100/50 text-[#181A27] dark:bg-amber-900/40 dark:text-amber-300",
  "Ready":             "bg-violet-100/50 text-[#181A27] dark:bg-violet-900/40 dark:text-violet-300",
  "Paid":              "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  "Unpaid":            "bg-red-100/50 text-[#181A27] dark:bg-red-900/40 dark:text-red-300",
  "Ready for embassy": "bg-sky-100/50 text-[#181A27] dark:bg-sky-900/40 dark:text-sky-300",
  "Sent to Embassy":   "bg-violet-100/50 text-[#181A27] dark:bg-violet-900/40 dark:text-violet-300",
  "Privately Sent":    "bg-cyan-100/50 text-[#181A27] dark:bg-cyan-900/40 dark:text-cyan-300",
  "Issued":            "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  "Visa canceled":     "bg-red-100/50 text-[#181A27] dark:bg-red-900/40 dark:text-red-300",
  "Arrived KSA":       "bg-green-100/50 text-[#181A27] dark:bg-green-900/40 dark:text-green-300",
  "Returned":          "bg-orange-100/50 text-[#181A27] dark:bg-orange-900/40 dark:text-orange-300",
  "Waiting Replacement":"bg-amber-100/50 text-[#181A27] dark:bg-amber-900/40 dark:text-amber-300",
  "Pending":           "bg-amber-100/50 text-[#181A27] dark:bg-amber-900/40 dark:text-amber-300",
  "No COC":            "bg-red-100/50 text-[#181A27] dark:bg-red-900/40 dark:text-red-300",
  "Not tested":        "bg-zinc-100/50 text-[#181A27] dark:bg-zinc-800 dark:text-zinc-400",
  "Imported":          "bg-violet-100/50 text-[#181A27] dark:bg-violet-900/40 dark:text-violet-300",
  "Checked":           "bg-teal-100/50 text-[#181A27] dark:bg-teal-900/40 dark:text-teal-300",
  "Verified":          "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  "Draft":             "bg-zinc-100/50 text-[#181A27] dark:bg-zinc-800 dark:text-zinc-400",
  "Rejected":          "bg-red-100/50 text-[#181A27] dark:bg-red-900/40 dark:text-red-300",
  "New Order":         "bg-blue-100/50 text-[#181A27] dark:bg-blue-900/40 dark:text-blue-300",
  "Exchange":          "bg-orange-100/50 text-[#181A27] dark:bg-orange-900/40 dark:text-orange-300",
  "Urgent":            "bg-red-100/50 text-[#181A27] dark:bg-red-900/40 dark:text-red-300",
  "available":         "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  "processing":        "bg-amber-100/50 text-[#181A27] dark:bg-amber-900/40 dark:text-amber-300",
  "arrived":           "bg-blue-100/50 text-[#181A27] dark:bg-blue-900/40 dark:text-blue-300",
  "canceled":          "bg-red-100/50 text-[#181A27] dark:bg-red-900/40 dark:text-red-300",
  "returned":          "bg-orange-100/50 text-[#181A27] dark:bg-orange-900/40 dark:text-orange-300",
};

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
  coc:     "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  medical: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  medexp:  "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  lmis:    "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  ticket:  "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  embassy: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
  visaready:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  visareturn: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  tasheer:    "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  cvoverdue:  "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
};

// ─── Inline components ───────────────────────────────────────────────────────
type EditableField =
  | "notes" | "narrative" | "occupation" | "living_town" | "selected_by"
  | "medical_status" | "status" | "office" | "passport_status" | "musaned_status" | "coc_status"
  | "narrative_phone" | "contract_date" | "medical_date" | "medical_days"
  | "tasheer_status" | "tasheer_date" | "wokala_status" | "embassy_date"
  | "visa_status" | "insurance_status" | "unfilled_lmis" | "lmis_status"
  | "ticket_status" | "ticket_date" | "arrival_city" | "emergency_contact" | "processing_notes";

function OptionPill({ value }: { value: string }) {
  return (
    <span className={cn(
      "inline-block text-[11px] font-medium px-2 py-0.5 rounded-none whitespace-nowrap",
      OPTION_COLORS[value] ?? "bg-zinc-100/50 text-[#181A27] dark:bg-zinc-800 dark:text-zinc-400",
    )}>
      {value || "—"}
    </span>
  );
}

function InlineSelect({ value, options, onSave }: { value: string; options: string[]; onSave: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="text-left rounded-none px-1 -mx-1 py-0.5 hover:bg-muted/60 hover:ring-1 hover:ring-border block">
        {value ? <OptionPill value={value} /> : <span className="text-muted-foreground text-[14px]">—</span>}
      </button>
    );
  }
  return (
    <div className="relative z-20">
      <div className="absolute top-0 left-0 bg-background border border-border shadow-md rounded-none min-w-[140px]">
        {options.map((opt) => (
          <button key={opt} type="button"
            className={cn("w-full text-left px-3 py-1.5 text-[13px] hover:bg-muted/60 flex items-center gap-2", opt === value && "bg-muted/40 font-semibold")}
            onMouseDown={() => { setOpen(false); if (opt !== value) onSave(opt); }}>
            <OptionPill value={opt} />
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

function InlineText({ value, onSave, truncate }: { value: string; onSave: (v: string | null) => void; truncate?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(value);
  const words = value.trim().split(/\s+/);
  const isLong = truncate && words.length > 1;
  const display = isLong && !expanded ? `${words[0]}...` : (value || null);
  if (!editing) {
    if (truncate && expanded) {
      return (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-left rounded-none px-1 -mx-1 py-0.5 hover:bg-muted/60 hover:ring-1 hover:ring-border block whitespace-normal max-w-[260px] break-words text-[14px]"
        >
          {value}
        </button>
      );
    }
    return (
      <button
        type="button"
        title={isLong ? value : undefined}
        onClick={() => { if (isLong) { setExpanded(true); } else { setDraft(value); setEditing(true); } }}
        className={cn(
          "text-left rounded-none px-1 -mx-1 py-0.5 hover:bg-muted/60 hover:ring-1 hover:ring-border min-w-[60px] block text-[14px]",
          isLong && "cursor-pointer",
        )}
      >
        {display ?? <span className="text-muted-foreground">—</span>}
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
      className="rounded-none border border-primary bg-background px-1 py-0.5 text-[14px] text-[#181A27] outline-none min-w-[100px]" />
  );
}

function InlineDate({ value, onSave }: { value: string; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const fmt = (v: string) =>
    v ? new Date(v + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "";
  if (!editing) {
    return (
      <button type="button" onClick={() => { setDraft(value); setEditing(true); }}
        className="text-left rounded-none px-1 -mx-1 py-0.5 hover:bg-muted/60 hover:ring-1 hover:ring-border min-w-[60px] block">
        {value ? fmt(value) : <span className="text-muted-foreground">—</span>}
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
      className="rounded-none border border-primary bg-background px-1 py-0.5 text-[14px] text-[#181A27] outline-none min-w-[110px]" />
  );
}

// ─── Full candidate card (HR Pool style, no checkbox) ────────────────────────
function DashboardCandidateCard({
  candidate, onUpdateField, note, countryOptions,
}: {
  candidate: Candidate;
  onUpdateField: (field: EditableField, value: string | null) => void;
  note?: string | null;
  countryOptions: string[];
}) {
  const statusStyles: Record<Status, string> = {
    available: "bg-success text-success-foreground",
    processing: "bg-warning text-foreground",
    arrived: "bg-info text-info-foreground",
    canceled: "bg-destructive text-destructive-foreground",
    returned: "bg-orange-500 text-white",
  };
  const statusLabel: Record<Status, string> = {
    available: "Available", processing: "Processing", arrived: "Arrived", canceled: "Canceled", returned: "Returned",
  };
  const statusKey = (candidate.status in statusStyles ? candidate.status : "available") as Status;

  type FieldDef =
    | { label: string; value: string; bold?: boolean }
    | { label: string; value: string; edit: "text"; field: EditableField; long?: boolean }
    | { label: string; value: string; edit: "date"; field: EditableField }
    | { label: string; value: string; edit: "select"; field: EditableField; options: string[] };

  const fields: FieldDef[] = [
    { label: "FULL NAME",       value: candidate.full_name, bold: true },
    { label: "CANDIDATE CODE",  value: candidate.candidate_code ?? "—" },
    { label: "GENDER",          value: candidate.gender ?? "—" },
    { label: "RELIGION",        value: candidate.religion ?? "—" },
    { label: "MARITAL STATUS",  value: candidate.marital_status ?? "—" },
    { label: "BIRTH PLACE",     value: candidate.birth_place ?? "—" },
    { label: "LIVING TOWN",     value: candidate.living_town ?? "",    edit: "text",   field: "living_town" },
    { label: "OCCUPATION",      value: candidate.occupation ?? "",     edit: "text",   field: "occupation" },
    { label: "PASSPORT NUMBER", value: candidate.passport_number ?? "—" },
    { label: "LABOUR ID",       value: candidate.labour_id ?? "—" },
    { label: "OFFICE",          value: candidate.office ?? "",         edit: "select", field: "office",          options: OFFICE_OPTIONS },
    { label: "PASSPORT STATUS", value: candidate.passport_status ?? "", edit: "select", field: "passport_status", options: PASSPORT_OPTIONS },
    { label: "COC STATUS",      value: candidate.coc_status ?? "",     edit: "select", field: "coc_status",       options: COC_OPTIONS },
    { label: "COUNTRY",         value: candidate.musaned_status ?? "", edit: "select", field: "musaned_status",   options: countryOptions },
    { label: "MEDICAL STATUS",  value: candidate.medical_status ?? "", edit: "select", field: "medical_status",   options: MEDICAL_OPTIONS },
    { label: "MEDICAL DATE",    value: candidate.medical_date ? new Date(candidate.medical_date).toLocaleDateString() : "—" },
    { label: "AVAILABILITY",    value: statusKey,                      edit: "select", field: "status",           options: AVAILABILITY_OPTIONS },
    { label: "SELECTED BY",     value: candidate.selected_by ?? "",    edit: "text",   field: "selected_by" },
    { label: "CONTRACT DATE",   value: candidate.contract_date ?? "",  edit: "date",   field: "contract_date" },
    { label: "CV SENT TO",      value: candidate.cv_sent_to ?? "—" },
    { label: "CV SENT DATE",    value: candidate.cv_sent_date ? new Date(candidate.cv_sent_date).toLocaleDateString() : "—" },
    { label: "TICKET STATUS",   value: candidate.ticket_status ?? "",  edit: "select", field: "ticket_status",    options: TICKET_OPTIONS },
    { label: "TICKET DATE",     value: candidate.ticket_date ?? "",    edit: "date",   field: "ticket_date" },
    { label: "ARRIVAL CITY",    value: candidate.arrival_city ?? "",   edit: "select", field: "arrival_city",     options: ARRIVAL_CITY_OPTIONS },
    { label: "TASHEER STATUS",  value: candidate.tasheer_status ?? "", edit: "select", field: "tasheer_status",   options: TASHEER_OPTIONS },
    { label: "WOKALA STATUS",   value: candidate.wokala_status ?? "",  edit: "select", field: "wokala_status",    options: WOKALA_OPTIONS },
    { label: "VISA STATUS",     value: candidate.visa_status ?? "",    edit: "select", field: "visa_status",      options: VISA_OPTIONS },
    { label: "INSURANCE",       value: candidate.insurance_status ?? "", edit: "select", field: "insurance_status", options: INSURANCE_OPTIONS },
    { label: "LMIS STATUS",     value: candidate.lmis_status ?? "",    edit: "select", field: "lmis_status",      options: LMIS_OPTIONS },
    { label: "LMIS FILE",       value: candidate.unfilled_lmis ?? "",  edit: "select", field: "unfilled_lmis",    options: UNFILLED_LMIS_OPTIONS },
    { label: "NARRATIVE",       value: candidate.narrative ?? "",      edit: "text",   field: "narrative", long: true },
    { label: "NOTES",           value: candidate.notes ?? "",          edit: "text",   field: "notes",     long: true },
  ];

  return (
    <Card className={cn("relative overflow-visible rounded-none mx-[5px]")}>
      <span className={cn(
        "absolute -top-2 left-3 rounded-none px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
        statusStyles[statusKey],
      )}>
        {statusLabel[statusKey]}
      </span>
      {note && (
        <span className="absolute -top-2 right-3 rounded-none px-1.5 py-0.5 text-[10px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
          {note}
        </span>
      )}
      <CardContent className="p-0">
        <div className="grid grid-cols-[40px_1fr_auto] gap-3 items-center">
          <Avatar className="h-10 w-10 shrink-0 ml-3">
            {candidate.photo_url && <AvatarImage src={candidate.photo_url} alt={candidate.full_name} />}
            <AvatarFallback className="text-[10px]">{candidate.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="overflow-x-auto no-scrollbar">
            <div className="flex gap-5 items-start py-3">
              {fields.map((f) => (
                <div key={f.label} className="shrink-0">
                  <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase whitespace-nowrap mb-[5px]">
                    {f.label}
                  </div>
                  <div className={cn(
                    "text-[14px] text-[#181A27]",
                    "edit" in f && "long" in f && f.long ? "whitespace-normal" : "whitespace-nowrap",
                    "bold" in f && f.bold && "font-semibold",
                  )}>
                    {"edit" in f && f.edit === "text" ? (
                      <InlineText value={f.value} onSave={(v) => onUpdateField(f.field, v)} truncate={"long" in f && f.long} />
                    ) : "edit" in f && f.edit === "date" ? (
                      <InlineDate value={f.value} onSave={(v) => onUpdateField(f.field, v)} />
                    ) : "edit" in f && f.edit === "select" ? (
                      <InlineSelect value={f.value} options={f.options} onSave={(v) => onUpdateField(f.field, v)} />
                    ) : (
                      f.value || "—"
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 mb-[8px] pt-[10px] pr-[12px] pb-[10px] pl-[4px]">
            <Button asChild size="sm" className="h-6 w-18 text-[12px] px-2 rounded-none">
              <Link to="/staff/cv-generator" search={{ id: candidate.id }}>
                <FileText className="h-3.5 w-3.5 mr-1" /> VIEW
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Alert section ───────────────────────────────────────────────────────────
function AlertSection({
  icon: Icon, title, iconColor, pillKey, candidates, getNote, onUpdateField, countryOptions,
}: {
  icon: React.ElementType;
  title: string;
  iconColor: string;
  pillKey: keyof typeof ALERT_PILL;
  candidates: Candidate[];
  getNote?: (c: Candidate) => string | null;
  onUpdateField: (id: string, field: EditableField, value: string | null) => void;
  countryOptions: string[];
}) {
  const [open, setOpen] = useState(false);
  if (candidates.length === 0) return null;

  return (
    <div className="rounded-none border border-border overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-background hover:bg-muted/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
          <span className="text-sm font-semibold">{title}</span>
          <span className={cn("text-xs font-bold px-2 py-0.5 rounded-none", ALERT_PILL[pillKey])}>
            {candidates.length}
          </span>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border bg-muted/10 space-y-4 px-2 py-4">
          {candidates.map((c) => (
            <DashboardCandidateCard
              key={c.id}
              candidate={c}
              note={getNote?.(c) ?? null}
              onUpdateField={(field, value) => onUpdateField(c.id, field, value)}
              countryOptions={countryOptions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
function StaffDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const updateFieldFn = useServerFn(updateCandidateField);

  const { data: candidates = [] } = useQuery({
    queryKey: ["staff-dashboard-candidates", user?.id],
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
  const countryOptions = assignCountries.map((c) => c.name);

  const { data: managerCvThreshold = 7 } = useQuery({
    queryKey: ["staff-manager-cv-threshold", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("manager_id")
        .eq("user_id", user!.id)
        .eq("role", "staff")
        .maybeSingle();
      if (!roleRow?.manager_id) return 7;
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("cv_days_threshold")
        .eq("id", roleRow.manager_id)
        .maybeSingle();
      return profileRow?.cv_days_threshold ?? 7;
    },
  });

  const fieldMut = useMutation({
    mutationFn: async (input: { id: string; field: string; value: string | null }) =>
      updateFieldFn({ data: input as never }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["staff-dashboard-candidates", user?.id] }),
  });

  const handleUpdateField = (id: string, field: EditableField, value: string | null) =>
    fieldMut.mutate({ id, field, value });

  const total = candidates.length;
  const counts = {
    available: candidates.filter((c) => c.status === "available").length,
    processing: candidates.filter((c) => c.status === "processing").length,
    arrived:    candidates.filter((c) => c.status === "arrived").length,
    canceled:   candidates.filter((c) => c.status === "canceled").length,
    returned:   candidates.filter((c) => c.status === "returned").length,
  };

  const cocNotDone    = candidates.filter((c) => c.coc_status && c.coc_status !== "Done");
  const medicalNotFit = candidates.filter((c) => c.medical_status && c.medical_status !== "Fit");
  const cocDoneNotFit = candidates.filter((c) => c.coc_status === "Done" && c.medical_status && c.medical_status !== "Fit");
  const unfilledLmis  = candidates.filter((c) => c.status === "processing" && c.unfilled_lmis && c.unfilled_lmis.trim() !== "");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const medicalExpired = candidates.filter((c) => {
    if (c.medical_status === "Expired") return true;
    if (c.medical_status === "Fit" && c.medical_date) {
      const days = Math.floor((today.getTime() - new Date(c.medical_date + "T00:00:00").getTime()) / 86_400_000);
      return days >= 90;
    }
    return false;
  });

  const ticketNotBooked = candidates.filter((c) => {
    if (!c.contract_date) return false;
    if (c.ticket_status === "Booked") return false;
    const days = Math.floor((today.getTime() - new Date(c.contract_date + "T00:00:00").getTime()) / 86_400_000);
    return days > 20;
  });

  const embassyPending = candidates.filter(
    (c) => c.status === "processing" && c.tasheer_status === "Done" && c.visa_status !== "Ready for embassy" && c.processing_notes,
  );

  const visaReady = candidates.filter(
    (c) => c.status === "processing" && c.visa_status !== "Returned" && (
      (c.tasheer_status === "Done" && c.wokala_status === "Paid" && !c.visa_status) ||
      c.visa_status === "Ready for embassy"
    ),
  );

  const visaReturned = candidates.filter((c) => c.status === "processing" && c.visa_status === "Returned");
  const tasheerDoneWokalaUnpaid = candidates.filter(
    (c) => c.status === "processing" && c.tasheer_status === "Done" && c.wokala_status === "Unpaid",
  );
  const cvOverdue = candidates.filter((c) => {
    if (!c.cv_sent_to || c.selected_by || !c.cv_sent_date) return false;
    const days = Math.floor((today.getTime() - new Date(c.cv_sent_date + "T00:00:00").getTime()) / 86_400_000);
    return days >= managerCvThreshold;
  });
  const daysSince = (d: string) =>
    Math.floor((today.getTime() - new Date(d + "T00:00:00").getTime()) / 86_400_000);

  return (
    <div className="space-y-6 mx-[79.6px]">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <Button asChild size="sm" className="gap-2 text-xs h-8 rounded-none">
          <Link to="/staff/candidates">
            <Users className="h-4 w-4" /> HR Pool
          </Link>
        </Button>
      </div>

      {/* Status stat cards */}
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

      {/* Alert sections */}
      {(cocNotDone.length > 0 || medicalNotFit.length > 0 || cocDoneNotFit.length > 0 || medicalExpired.length > 0 || unfilledLmis.length > 0 || ticketNotBooked.length > 0 || embassyPending.length > 0 || visaReady.length > 0 || visaReturned.length > 0 || tasheerDoneWokalaUnpaid.length > 0 || cvOverdue.length > 0) && (
        <div className="space-y-2">
          <AlertSection icon={FileCheck}    title="COC — Not Done"               iconColor="text-orange-600 dark:text-orange-400" pillKey="coc"     candidates={cocNotDone}    onUpdateField={handleUpdateField} countryOptions={countryOptions} />
          <AlertSection icon={Stethoscope}  title="Medical — Not Fit"            iconColor="text-red-600 dark:text-red-400"       pillKey="medical" candidates={medicalNotFit} onUpdateField={handleUpdateField} countryOptions={countryOptions} />
          <AlertSection icon={Stethoscope}  title="COC Done — Medical Not Fit"  iconColor="text-fuchsia-600 dark:text-fuchsia-400" pillKey="medical" candidates={cocDoneNotFit} onUpdateField={handleUpdateField} countryOptions={countryOptions}
            getNote={(c) => c.medical_status ?? null} />
          <AlertSection icon={CalendarX}    title="Medical — Expired"            iconColor="text-rose-600 dark:text-rose-400"     pillKey="medexp"  candidates={medicalExpired} onUpdateField={handleUpdateField} countryOptions={countryOptions}
            getNote={(c) => {
              if (c.medical_status === "Expired") return "Set as expired";
              if (c.medical_date) return `${daysSince(c.medical_date)}d since medical`;
              return null;
            }} />
          <AlertSection icon={ClipboardList} title="LMIS file"               iconColor="text-amber-600 dark:text-amber-400"   pillKey="lmis"    candidates={unfilledLmis}  onUpdateField={handleUpdateField} countryOptions={countryOptions} />
          <AlertSection icon={Ticket}        title="Ticket Not Booked — Over 20 Days" iconColor="text-violet-600 dark:text-violet-400" pillKey="ticket" candidates={ticketNotBooked} onUpdateField={handleUpdateField} countryOptions={countryOptions}
            getNote={(c) => c.contract_date ? `${daysSince(c.contract_date)}d since contract` : null} />
          <AlertSection icon={Landmark}      title="Embassy Visa — Pending"      iconColor="text-sky-600 dark:text-sky-400"       pillKey="embassy"   candidates={embassyPending} onUpdateField={handleUpdateField} countryOptions={countryOptions}
            getNote={(c) => c.processing_notes ?? null} />
          <AlertSection icon={BadgeCheck}    title="Ready for Embassy Visa"      iconColor="text-emerald-600 dark:text-emerald-400" pillKey="visaready"  candidates={visaReady}     onUpdateField={handleUpdateField} countryOptions={countryOptions}
            getNote={(c) => c.visa_status === "Ready for embassy" ? "Manual" : null} />
          <AlertSection icon={RotateCcw}     title="Visa Returned"               iconColor="text-rose-600 dark:text-rose-400"       pillKey="visareturn" candidates={visaReturned}  onUpdateField={handleUpdateField} countryOptions={countryOptions}
            getNote={(c) => c.remark ?? null} />
          <AlertSection icon={AlertTriangle} title="Tasheer Done — Wokala Unpaid" iconColor="text-violet-600 dark:text-violet-400"   pillKey="tasheer"   candidates={tasheerDoneWokalaUnpaid} onUpdateField={handleUpdateField} countryOptions={countryOptions} />
          <AlertSection icon={Send}          title="CV Sent — No Selection"        iconColor="text-teal-600 dark:text-teal-400"        pillKey="cvoverdue" candidates={cvOverdue}               onUpdateField={handleUpdateField} countryOptions={countryOptions}
            getNote={(c) => c.cv_sent_date ? `${Math.floor((today.getTime() - new Date(c.cv_sent_date + "T00:00:00").getTime()) / 86_400_000)}d ago` : null} />
        </div>
      )}
    </div>
  );
}
