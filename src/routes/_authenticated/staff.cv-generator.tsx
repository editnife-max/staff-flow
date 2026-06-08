import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Download, FileText, User, ArrowUpDown, ChevronDown, ChevronUp,
  Send, ClipboardPaste, X, RotateCcw, Stethoscope, Briefcase, FileCheck,
  Globe, BookOpen, Users, Calendar, SlidersHorizontal,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { ActionDialog as BulkActionDialog } from "@/components/action-dialog";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import PizZip from "pizzip";
import * as XLSX from "xlsx";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, calcAge } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/staff/cv-generator")({
  head: () => ({ meta: [{ title: "CV Page — Staff-Flow" }] }),
  validateSearch: z.object({ id: z.string().optional() }),
  component: CvGeneratorPage,
});

type CvTemplate = Database["public"]["Tables"]["cv_templates"]["Row"];
type Candidate  = Database["public"]["Tables"]["candidates"]["Row"];

// ── DOCX fill ─────────────────────────────────────────────────────────────────

function xmlEsc(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
          .replace(/"/g,"&quot;");
}

function _cellText(xml: string, from: number, to: number): string {
  let text = "";
  let p = from;
  while (p < to) {
    const tOpen = xml.indexOf("<w:t", p);
    if (tOpen === -1 || tOpen >= to) break;
    const gt = xml.indexOf(">", tOpen);
    if (gt === -1 || gt >= to) break;
    const tClose = xml.indexOf("</w:t>", gt + 1);
    if (tClose === -1 || tClose >= to) break;
    text += xml.slice(gt + 1, tClose);
    p = tClose + 6;
  }
  return text;
}

function fillField(xml: string, label: string, value: string): string {
  let pos = 0;
  while (pos < xml.length) {
    const cellStart = xml.indexOf("<w:tc", pos);
    if (cellStart === -1) break;
    const cellEnd = xml.indexOf("</w:tc>", cellStart);
    if (cellEnd === -1) break;
    if (_cellText(xml, cellStart, cellEnd).trim() === label) {
      const nextStart = xml.indexOf("<w:tc", cellEnd + 7);
      if (nextStart === -1) { pos = cellEnd + 7; continue; }
      const nextEnd = xml.indexOf("</w:tc>", nextStart);
      if (nextEnd === -1) { pos = cellEnd + 7; continue; }
      let first = true;
      const newCell = xml.slice(nextStart, nextEnd + 7).replace(
        /<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g,
        (_, attrs) => {
          if (first) {
            first = false;
            const spaceAttr = value.includes(" ") ? ' xml:space="preserve"' : (attrs ?? "");
            return `<w:t${spaceAttr}>${xmlEsc(value)}</w:t>`;
          }
          return `<w:t${attrs ?? ""}></w:t>`;
        },
      );
      return xml.slice(0, nextStart) + newCell + xml.slice(nextEnd + 7);
    }
    pos = cellEnd + 7;
  }
  return xml;
}

async function buildFilledDocxBase64(url: string, c: Candidate): Promise<string> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 100) throw new Error("Template file is empty");
  const zip   = new PizZip(buf);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("word/document.xml missing");
  let xml = new TextDecoder("utf-8").decode(entry.asUint8Array());
  const fields: [string, string | null | undefined][] = [
    ["FULL NAME",      c.full_name],
    ["POSITION",       c.occupation],
    ["NUMBER",         c.passport_number],
    ["DATE OF ISSUE",  c.passport_issue_date],
    ["DATE OF EXPIRY", c.passport_expiry_date],
    ["PLACE OF ISSUE", c.place_of_issue ?? c.country],
    ["ENGLISH",        c.english_level],
    ["ARABIC",         c.arabic_level],
    ["EXPERIENCE",     c.experience],
    ["NATIONALITY",    c.country],
    ["RELIGION",       c.religion],
    ["DATE OF BIRTH",  c.dob],
    ["PLACE OF BIRTH", c.birth_place],
    ["LIVING TOWN",    c.living_town],
    ["AGE",            c.age  != null ? String(c.age)  : null],
    ["MARITAL STATUS", c.marital_status],
    ["CHILDREN",       c.children != null ? String(c.children) : null],
    ["WEIGHT",         c.weight != null ? `${c.weight} kg` : null],
    ["HEIGHT",         c.height != null ? `${c.height} cm` : null],
    ["REMARK",         c.notes ?? c.remark],
  ];
  for (const [label, value] of fields) {
    if (!value) continue;
    xml = fillField(xml, label, String(value));
  }
  zip.file("word/document.xml", new TextEncoder().encode(xml));
  return zip.generate({ type: "base64" });
}

// ── CV Preview ────────────────────────────────────────────────────────────────

const NAVY  = "#1A3A6B";
const BLUE  = "#2B5BA8";
const LBLUE = "#AACCEE";
const WHITE = "#FFFFFF";
const GRAY  = "#F2F4F8";
const DARK  = "#222222";
const BORDER = "1px solid #CCCCCC";

type CSSProps = React.CSSProperties;

function td(extra: CSSProps = {}): CSSProps {
  return { padding: "5px 9px", border: BORDER, fontSize: 11,
           fontFamily: "Arial, sans-serif", verticalAlign: "middle", ...extra };
}

function SectionHdr({ en, ar }: { en: string; ar: string }) {
  return (
    <tr>
      <td colSpan={2} style={td({ backgroundColor: BLUE, color: WHITE, fontWeight: "bold", border: "none" })}>{en}</td>
      <td colSpan={2} style={td({ backgroundColor: BLUE, color: LBLUE, textAlign: "right", border: "none", direction: "rtl" })}>{ar}</td>
    </tr>
  );
}

function DataRow({ lbl, val, ar, bg1=GRAY, bg2=WHITE, span=false }:
  { lbl: string; val?: string|number|null; ar: string; bg1?: string; bg2?: string; span?: boolean }) {
  return (
    <tr>
      <td style={td({ backgroundColor: bg1, color: DARK, fontWeight: "bold" })}>{lbl}</td>
      {span
        ? <td colSpan={3} style={td({ backgroundColor: bg2, color: DARK })}>{val ?? ""}</td>
        : <>
            <td style={td({ backgroundColor: bg2, color: DARK })}>{val ?? ""}</td>
            <td style={td({ backgroundColor: bg1, color: DARK, fontWeight: "bold", textAlign: "right", direction: "rtl" })}>{ar}</td>
            <td style={td({ backgroundColor: bg2, color: DARK })}></td>
          </>
      }
    </tr>
  );
}

function CvPreview({ candidate: c, template }: { candidate: Candidate; template: CvTemplate | null }) {
  const photo = c.full_photo_url ?? c.photo_url;
  return (
    <div style={{ width: 720, fontFamily: "Arial, sans-serif", backgroundColor: WHITE, color: DARK }}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "27%" }} /><col style={{ width: "28%" }} />
          <col style={{ width: "21%" }} /><col style={{ width: "24%" }} />
        </colgroup>
        <tbody>
          <tr>
            <td colSpan={2} style={{ backgroundColor: NAVY, padding: "14px 16px", border: "none" }}>
              {template && <div style={{ color: LBLUE, fontSize: 9, marginBottom: 2 }}>{template.name}</div>}
              <div style={{ color: WHITE, fontSize: 15, fontWeight: "bold" }}>APPLICATION FOR EMPLOYMENT</div>
            </td>
            <td colSpan={2} style={{ backgroundColor: NAVY, padding: "14px 16px", border: "none",
                                     textAlign: "right", verticalAlign: "middle", direction: "rtl" }}>
              {photo && <img src={photo} alt="" crossOrigin="anonymous"
                style={{ width: 60, height: 72, objectFit: "cover", float: "left", marginRight: 8, border: "1px solid rgba(255,255,255,0.3)" }} />}
              <span style={{ color: LBLUE, fontSize: 14 }}>طلب توظيف</span>
            </td>
          </tr>
          <tr>
            <td style={td({ backgroundColor: NAVY, color: WHITE, fontWeight: "bold", border: "none" })}>FULL NAME</td>
            <td style={td({ backgroundColor: NAVY, color: WHITE, fontWeight: "bold", fontSize: 13, border: "none" })}>{c.full_name}</td>
            <td style={td({ backgroundColor: NAVY, color: LBLUE, fontWeight: "bold", textAlign: "right", border: "none", direction: "rtl" })}>الاسم الكامل</td>
            <td style={td({ backgroundColor: NAVY, border: "none" })}></td>
          </tr>
          <tr>
            <td style={td({ backgroundColor: BLUE, color: WHITE, fontWeight: "bold", border: "none" })}>CONTRACT PERIOD</td>
            <td style={td({ backgroundColor: BLUE, color: WHITE, border: "none" })}>2 years</td>
            <td style={td({ backgroundColor: BLUE, color: LBLUE, textAlign: "right", border: "none", direction: "rtl" })}>مدة العقد</td>
            <td style={td({ backgroundColor: BLUE, border: "none" })}></td>
          </tr>
          <tr>
            <td style={td({ backgroundColor: BLUE, color: WHITE, fontWeight: "bold", border: "none" })}>POSITION</td>
            <td style={td({ backgroundColor: BLUE, color: WHITE, border: "none" })}>{c.occupation || "House Maid"}</td>
            <td style={td({ backgroundColor: BLUE, color: LBLUE, textAlign: "right", border: "none", direction: "rtl" })}>الوظيفة</td>
            <td style={td({ backgroundColor: BLUE, border: "none" })}></td>
          </tr>
          <SectionHdr en="PASSPORT DETAIL  |" ar="بيانات جواز السفر" />
          <DataRow lbl="NUMBER"         val={c.passport_number}       ar="رقم الجواز"      bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="DATE OF ISSUE"  val={c.passport_issue_date}   ar="تاريخ الإصدار"   bg1={WHITE} bg2={GRAY}  />
          <DataRow lbl="DATE OF EXPIRY" val={c.passport_expiry_date}  ar="تاريخ الانتهاء"  bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="PLACE OF ISSUE" val={c.place_of_issue ?? c.country} ar="مكان الإصدار" bg1={WHITE} bg2={GRAY} />
          <SectionHdr en="LANGUAGE AND EDUCATION  |" ar="اللغة والتعليم" />
          <DataRow lbl="ENGLISH" val={c.english_level} ar="اللغة الإنجليزية" bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="ARABIC"  val={c.arabic_level}  ar="اللغة العربية"    bg1={WHITE} bg2={GRAY}  />
          <DataRow lbl="EDUCATION" val={c.education}   ar="التعليم"           bg1={GRAY}  bg2={WHITE} />
          <SectionHdr en="EXPERIENCE ABROAD  |" ar="الخبرة خارج البلد" />
          <DataRow lbl="EXPERIENCE" val={c.experience} ar="الخبرة" span bg1={GRAY} bg2={WHITE} />
          <SectionHdr en="PERSONAL DATA  |" ar="معلومات شخصية" />
          <DataRow lbl="NATIONALITY"    val={c.country}        ar="الجنسية"           bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="RELIGION"       val={c.religion}       ar="الديانة"           bg1={WHITE} bg2={GRAY}  />
          <DataRow lbl="DATE OF BIRTH"  val={c.dob}            ar="تاريخ الميلاد"     bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="PLACE OF BIRTH" val={c.birth_place}    ar="مكان الميلاد"      bg1={WHITE} bg2={GRAY}  />
          <DataRow lbl="LIVING TOWN"    val={c.living_town}    ar="مكان الإقامة"      bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="AGE"            val={c.age ?? ""}      ar="العمر"             bg1={WHITE} bg2={GRAY}  />
          <DataRow lbl="MARITAL STATUS" val={c.marital_status} ar="الحالة الاجتماعية" bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="CHILDREN"       val={c.children ?? ""} ar="عدد الأطفال"       bg1={WHITE} bg2={GRAY}  />
          <DataRow lbl="WEIGHT"         val={c.weight != null ? `${c.weight} kg` : ""} ar="الوزن" bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="HEIGHT"         val={c.height != null ? `${c.height} cm` : ""} ar="الطول" bg1={WHITE} bg2={GRAY}  />
          <SectionHdr en="SKILLS  |" ar="المهارات" />
          {c.skills
            ? <tr><td colSpan={4} style={td({ backgroundColor: WHITE, color: DARK })}>{c.skills}</td></tr>
            : <tr><td colSpan={4} style={td({ backgroundColor: WHITE, color: "#aaa" })}>—</td></tr>
          }
          <DataRow lbl="REMARK" val={c.notes ?? c.remark ?? ""} ar="" span bg1={GRAY} bg2={WHITE} />
        </tbody>
      </table>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DOWNLOAD_TYPES = [
  { id: "summary-pdf",  label: "Download Summary (PDF)",    group: "export" as const },
  { id: "excel",        label: "Download Excel",            group: "export" as const },
  { id: "excel-ticket", label: "Download Excel for Ticket", group: "export" as const },
  { id: "normal-cv",    label: "Normal CV",                 group: "cv"     as const },
  { id: "jawa-cv",      label: "Jawa CV",                   group: "cv"     as const },
  { id: "tadbeer-cv",   label: "Tadbeer CV",                group: "cv"     as const },
  { id: "milano-cv",    label: "Milano CV",                 group: "cv"     as const },
  { id: "ghadeer-cv",   label: "Ghadeer CV",                group: "cv"     as const },
  { id: "normal22-cv",  label: "Normal 22 CV",              group: "cv"     as const },
];

const EXPORT_COLUMNS: { key: keyof Candidate; label: string }[] = [
  { key: "full_name",            label: "Full Name" },
  { key: "candidate_code",       label: "Candidate Code" },
  { key: "gender",               label: "Gender" },
  { key: "religion",             label: "Religion" },
  { key: "marital_status",       label: "Marital Status" },
  { key: "birth_place",          label: "Birth Place" },
  { key: "living_town",          label: "Living Town" },
  { key: "occupation",           label: "Occupation" },
  { key: "country",              label: "Nationality" },
  { key: "passport_number",      label: "Passport Number" },
  { key: "passport_issue_date",  label: "Passport Issue Date" },
  { key: "passport_expiry_date", label: "Passport Expiry Date" },
  { key: "place_of_issue",       label: "Place of Issue" },
  { key: "dob",                  label: "Date of Birth" },
  { key: "age",                  label: "Age" },
  { key: "english_level",        label: "English Level" },
  { key: "arabic_level",         label: "Arabic Level" },
  { key: "education",            label: "Education" },
  { key: "experience",           label: "Experience" },
  { key: "skills",               label: "Skills" },
  { key: "weight",               label: "Weight" },
  { key: "height",               label: "Height" },
  { key: "medical_status",       label: "Medical Status" },
  { key: "medical_date",         label: "Medical Date" },
  { key: "coc_status",           label: "COC Status" },
  { key: "office",               label: "Office" },
  { key: "selected_by",          label: "Selected By" },
  { key: "cv_sent_to",           label: "CV Sent To" },
  { key: "destination_country",  label: "Destination Country" },
  { key: "notes",                label: "Notes" },
];

const TICKET_DEFAULT_COLS: (keyof Candidate)[] = [
  "full_name", "passport_number", "passport_expiry_date",
  "dob", "country", "occupation", "destination_country", "office",
];

const SORT_FIELDS = [
  { key: "full_name",      label: "Full Name" },
  { key: "occupation",     label: "Occupation" },
  { key: "country",        label: "Nationality" },
  { key: "medical_status", label: "Medical Status" },
  { key: "coc_status",     label: "COC Status" },
  { key: "office",         label: "Office" },
];

const OPTION_COLORS: Record<string, string> = {
  Fit:              "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  Done:             "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  Unfit:            "bg-red-100/50 text-[#181A27] dark:bg-red-900/40 dark:text-red-300",
  Booked:           "bg-blue-100/50 text-[#181A27] dark:bg-blue-900/40 dark:text-blue-300",
  "In progress":    "bg-amber-100/50 text-[#181A27] dark:bg-amber-900/40 dark:text-amber-300",
  Expired:          "bg-orange-100/50 text-[#181A27] dark:bg-orange-900/40 dark:text-orange-300",
  No:               "bg-zinc-100/50 text-[#181A27] dark:bg-zinc-800 dark:text-zinc-400",
  Placed:           "bg-violet-100/50 text-[#181A27] dark:bg-violet-900/40 dark:text-violet-300",
  Yitazez:          "bg-orange-100/50 text-[#181A27] dark:bg-orange-900/40 dark:text-orange-300",
  "Pending release":"bg-amber-100/50 text-[#181A27] dark:bg-amber-900/40 dark:text-amber-300",
};

// ── Candidate card ─────────────────────────────────────────────────────────────

function CvCandidateCard({
  candidate: c, selected, onToggleSelect, onAction, overdueDays, lockedDaysLeft,
}: { candidate: Candidate; selected: boolean; onToggleSelect: () => void; onAction: () => void; overdueDays?: number; lockedDaysLeft?: number }) {
  type FieldDef = { label: string; value: string; bold?: boolean; badge?: boolean };
  const fields: FieldDef[] = [
    { label: "FULL NAME",      value: c.full_name,                                                   bold: true },
    { label: "CANDIDATE CODE", value: c.candidate_code ?? "—" },
    { label: "GENDER",         value: c.gender ?? "—" },
    { label: "AGE",            value: String(calcAge(c.dob) ?? c.age ?? "—") },
    { label: "RELIGION",       value: c.religion ?? "—" },
    { label: "MARITAL STATUS", value: c.marital_status ?? "—" },
    { label: "BIRTH PLACE",    value: c.birth_place ?? "—" },
    { label: "LIVING TOWN",    value: c.living_town ?? "—" },
    { label: "OCCUPATION",     value: c.occupation ?? "—" },
    { label: "NATIONALITY",    value: c.country ?? "—" },
    { label: "PASSPORT #",     value: c.passport_number ?? "—" },
    { label: "DOB",            value: c.dob ?? "—" },
    { label: "OFFICE",         value: c.office ?? "—" },
    { label: "COC STATUS",     value: c.coc_status ?? "—",     badge: true },
    { label: "MEDICAL STATUS", value: c.medical_status ?? "—", badge: true },
    { label: "MEDICAL DATE",   value: c.medical_date ? new Date(c.medical_date).toLocaleDateString() : "—" },
    { label: "SELECTED BY",    value: c.selected_by ?? "—" },
    { label: "CV SENT TO",     value: c.cv_sent_to ?? "—" },
    { label: "CV SENT DATE",   value: c.cv_sent_date ? new Date(c.cv_sent_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "—" },
  ];

  return (
    <div className={cn(
      "bg-white border border-border shadow-sm rounded-sm transition-colors",
      selected && "ring-1 ring-primary/50 bg-primary/5",
      lockedDaysLeft != null && "opacity-60",
    )}>
      {/* Status badge + checkbox + indicators row */}
      <div className="flex items-center gap-2 px-4 pt-2.5 pb-1">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          disabled={lockedDaysLeft != null}
          aria-label="Select candidate"
        />
        <StatusBadge status="available" />
        {lockedDaysLeft != null ? (
          <span className="ml-auto rounded-none px-1.5 py-0.5 text-[10px] font-semibold bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            Locked · {lockedDaysLeft}d left
          </span>
        ) : overdueDays != null ? (
          <span className="ml-auto rounded-none px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
            Resend · {overdueDays}d
          </span>
        ) : null}
      </div>

      {/* Main content row */}
      <div className="flex items-center gap-4 pl-4 pb-3 pt-1">
        {/* Photo */}
        <div className="shrink-0">
          <Avatar className="h-14 w-14">
            {c.photo_url && <AvatarImage src={c.photo_url} alt={c.full_name} />}
            <AvatarFallback className="text-[11px]">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>

        {/* Fields */}
        <div className="flex-1">
          <div className="flex gap-6 items-start py-1">
            {fields.map((f) => (
              <div key={f.label} className="shrink-0 w-[90px]">
                <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1 whitespace-nowrap">
                  {f.label}
                </div>
                {f.badge && f.value && f.value !== "—" ? (
                  <span className={cn(
                    "text-[11px] font-semibold px-1.5 py-0.5 rounded-sm whitespace-nowrap",
                    OPTION_COLORS[f.value] ?? "bg-zinc-100/50 text-[#181A27]",
                  )}>
                    {f.value}
                  </span>
                ) : (
                  <div className={cn(
                    "text-sm text-foreground break-words",
                    f.bold && "font-semibold",
                  )}>
                    {f.value || "—"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions — sticky right */}
        <div className={cn(
          "sticky right-0 z-10 self-stretch shrink-0 flex flex-col justify-center items-end gap-1.5 pr-4 pl-3",
          "shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.07)]",
          selected ? "bg-primary/5" : "bg-white",
        )}>
          <Button
            size="sm"
            onClick={onAction}
            className="bg-[#5cb8c4] hover:bg-[#4aa8b4] text-white px-5 h-8 rounded text-xs font-semibold tracking-wide"
          >
            VIEW
          </Button>
        </div>
      </div>
    </div>
  );
}

function _unusedActionDialog({
  candidate: c, templates, onClose,
}: {
  candidate: Candidate | null;
  templates: CvTemplate[];
  onClose: () => void;
}) {
  const cvRef = useRef<HTMLDivElement>(null);
  const [downloadType, setDownloadType] = useState("normal-cv");
  const [sortBy,  setSortBy]  = useState("full_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedCols, setSelectedCols] = useState<Set<string>>(
    new Set(EXPORT_COLUMNS.map((col) => col.key as string)),
  );
  const [downloading, setDownloading] = useState(false);
  const [sortOpen,     setSortOpen]     = useState(false);
  const [typeOpen,     setTypeOpen]     = useState(true);

  // Pre-select ticket columns when ticket type chosen
  useEffect(() => {
    if (downloadType === "excel-ticket") {
      setSelectedCols(new Set(TICKET_DEFAULT_COLS as string[]));
    }
  }, [downloadType]);

  const currentType = DOWNLOAD_TYPES.find((t) => t.id === downloadType)!;
  const isCV = currentType.group === "cv";

  const matchedTemplate = isCV && downloadType !== "normal-cv"
    ? templates.find((t) =>
        t.name.toLowerCase().includes(
          currentType.label.toLowerCase().replace(" cv", "").trim(),
        ),
      ) ?? null
    : null;

  const toggleCol = (key: string) =>
    setSelectedCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handleDownload = async () => {
    if (!c) return;
    setDownloading(true);
    try {

      if (isCV) {
        if (matchedTemplate) {
          // Use the matched DOCX or PDF template
          const isDocx = matchedTemplate.file_url.split("?")[0].toLowerCase().endsWith(".docx");
          if (isDocx) {
            const b64 = await buildFilledDocxBase64(matchedTemplate.file_url, c);
            const a = document.createElement("a");
            a.href = `data:application/octet-stream;base64,${b64}`;
            a.download = `${c.full_name} — ${currentType.label}.docx`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            toast.success(`${currentType.label} downloaded`);
          } else {
            const res = await fetch(matchedTemplate.file_url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = new Blob([await res.arrayBuffer()], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `${c.full_name} — ${currentType.label}.pdf`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 30_000);
            toast.success(`${currentType.label} downloaded`);
          }
        } else {
          // No matching template — generate PDF from the HTML preview
          if (downloadType !== "normal-cv") {
            toast.info(`No template found for "${currentType.label}" — using Normal CV format.`);
          }
          if (!cvRef.current) throw new Error("CV preview not ready — please wait and try again.");
          const canvas = await html2canvas(cvRef.current, {
            scale: 2, backgroundColor: "#ffffff", useCORS: true, allowTaint: false,
            onclone: (_doc, el) => {
              _doc.querySelectorAll('link[rel="stylesheet"], style').forEach((s) => s.remove());
              el.style.color = "#222222";
              el.style.backgroundColor = "#ffffff";
            },
          });
          const pxW = canvas.width / 2, pxH = canvas.height / 2;
          const pdf = new jsPDF({ unit: "px", format: [pxW, pxH] });
          pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pxW, pxH);
          pdf.save(`${c.full_name} — ${currentType.label}.pdf`);
          toast.success(`${currentType.label} downloaded`);
        }

      } else if (downloadType === "summary-pdf") {
        const cols = EXPORT_COLUMNS.filter((col) => selectedCols.has(col.key as string));
        if (cols.length === 0) throw new Error("Select at least one column to export.");
        const tableEl = document.createElement("div");
        // position off-screen so it renders without flashing on screen
        tableEl.style.cssText = "position:absolute;left:-9999px;top:0;width:800px;padding:24px;background:#fff;font-family:Arial,sans-serif";
        tableEl.innerHTML = `
          <h2 style="margin:0 0 16px;font-size:16px;color:#1a3a52;font-family:Arial,sans-serif">${c.full_name} — Summary</h2>
          <table style="width:100%;border-collapse:collapse;font-size:11px;font-family:Arial,sans-serif">
            ${cols.map((col) => `
              <tr>
                <td style="padding:5px 10px;background:#f2f4f8;font-weight:bold;border:1px solid #ccc;width:40%">${col.label}</td>
                <td style="padding:5px 10px;border:1px solid #ccc">${String(c[col.key] ?? "—")}</td>
              </tr>
            `).join("")}
          </table>`;
        document.body.appendChild(tableEl);
        const canvas = await html2canvas(tableEl, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
        document.body.removeChild(tableEl);
        const pxW = canvas.width / 2, pxH = canvas.height / 2;
        const pdf = new jsPDF({ unit: "px", format: [pxW, pxH] });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pxW, pxH);
        pdf.save(`${c.full_name} — Summary.pdf`);
        toast.success("Summary PDF downloaded");

      } else {
        // Download Excel / Download Excel for Ticket → real .xlsx spreadsheet
        const cols = EXPORT_COLUMNS.filter((col) => selectedCols.has(col.key as string));
        if (cols.length === 0) throw new Error("Select at least one column to export.");
        const header = cols.map((col) => col.label);
        const row    = cols.map((col) => {
          const v = c[col.key];
          return v == null ? "" : typeof v === "number" ? v : String(v);
        });
        const ws = XLSX.utils.aoa_to_sheet([header, row]);
        // Auto-size columns
        ws["!cols"] = header.map((h, i) => ({
          wch: Math.max(h.length, String(row[i] ?? "").length, 10),
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Candidate");
        const buf  = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url  = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${c.full_name} — ${currentType.label}.xlsx`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        toast.success(`${currentType.label} downloaded`);
      }

    } catch (e: any) {
      toast.error(e.message ?? "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const canDownload = !downloading;

  return (
    <Dialog open={!!c} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="rounded-none p-0 gap-0 overflow-hidden"
        style={{ maxWidth: 1400, width: "98vw", maxHeight: "92vh", display: "flex", flexDirection: "column" }}
      >
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="text-base font-semibold">
            Action — {c?.full_name}
          </DialogTitle>
        </DialogHeader>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left panel */}
          <div className="w-[360px] shrink-0 border-r flex flex-col overflow-y-auto">

            {/* Sort Options — collapsible */}
            <div className="border-b">
              <button
                type="button"
                onClick={() => setSortOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sort Options (for Export)
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", sortOpen && "rotate-180")} />
              </button>
              {sortOpen && (
                <div className="px-4 pb-4 flex items-center gap-2">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-8 text-xs rounded-none flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_FIELDS.map((f) => (
                        <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
                    className="h-8 w-8 shrink-0 flex items-center justify-center border rounded-none text-muted-foreground hover:bg-muted"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[10px] text-muted-foreground shrink-0">{sortDir.toUpperCase()}</span>
                </div>
              )}
            </div>

            {/* Choose Download Type — collapsible */}
            <div className="border-b">
              <button
                type="button"
                onClick={() => setTypeOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Choose Download Type
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", typeOpen && "rotate-180")} />
              </button>
              {typeOpen && (
                <div className="px-4 pb-4 space-y-0.5">
                  {DOWNLOAD_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDownloadType(t.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm rounded-none border transition-colors",
                        downloadType === t.id
                          ? "border-primary/40 bg-primary/5 text-primary font-medium"
                          : "border-transparent hover:border-border hover:bg-muted/40 text-muted-foreground",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Select Columns */}
            <div className="p-4 flex-1 min-h-0">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Select Columns
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCols(new Set(EXPORT_COLUMNS.map((c) => c.key as string)))}
                    className="text-[9px] text-primary hover:underline"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCols(new Set())}
                    className="text-[9px] text-muted-foreground hover:underline"
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                {EXPORT_COLUMNS.map((col) => (
                  <label key={col.key as string} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedCols.has(col.key as string)}
                      onCheckedChange={() => toggleCol(col.key as string)}
                      className="rounded-none h-3.5 w-3.5"
                    />
                    <span className="text-xs text-foreground">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel — preview */}
          <div className="flex-1 overflow-auto bg-muted/30 p-4">
            {c && isCV ? (
              <div ref={cvRef} className="mx-auto shadow-xl w-fit">
                <CvPreview candidate={c} template={matchedTemplate} />
              </div>
            ) : c ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <FileText className="h-14 w-14 opacity-15" />
                <p className="text-sm font-medium">{currentType.label}</p>
                <p className="text-xs opacity-60 text-center max-w-[240px]">
                  {downloadType === "summary-pdf"
                    ? "A PDF table will be generated with the selected columns."
                    : "An Excel (.xlsx) spreadsheet will be generated with the selected columns."}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t shrink-0 flex items-center justify-between gap-4">
          {isCV && downloadType !== "normal-cv" && !matchedTemplate ? (
            <p className="text-xs text-muted-foreground">
              No template for &ldquo;{currentType.label}&rdquo; — will download as Normal CV format.
            </p>
          ) : (
            <span />
          )}
          <Button
            onClick={handleDownload}
            disabled={!canDownload}
            className="rounded-none shrink-0"
          >
            <Download className="h-4 w-4 mr-2" />
            {downloading ? "Downloading…" : `Download — ${currentType.label}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const MEDICAL_OPTIONS = ["Fit", "Booked", "Unfit", "No", "In progress", "Expired"];

const CV_REQ_KEY = "cv-page-requirements";

function getCvReqDefaults() {
  const defaults = {
    age: "all", gender: "all", religion: "all", medical: "Fit",
    narrative: "all", experience: "all", coc: "Done",
    musaned: "all", selected_by: "all", cv_sent_to: "all",
    english_level: "all",
  };
  try {
    const saved = localStorage.getItem(CV_REQ_KEY);
    if (!saved) return defaults;
    const req = JSON.parse(saved);
    return {
      age:          req.age          ?? defaults.age,
      gender:       req.gender       ?? defaults.gender,
      religion:     req.religion     ?? defaults.religion,
      medical:      req.medical      ?? defaults.medical,
      narrative:    req.narrative    ?? defaults.narrative,
      experience:   req.experience   ?? defaults.experience,
      coc:          req.coc          ?? defaults.coc,
      musaned:      req.musaned      ?? defaults.musaned,
      selected_by:  req.selected_by  ?? defaults.selected_by,
      cv_sent_to:   req.cv_sent_to   ?? defaults.cv_sent_to,
      english_level:req.english_level?? defaults.english_level,
    };
  } catch { return defaults; }
}

const initialFilters = {
  sort: "newest",
  ...getCvReqDefaults(),
  from: "",
  to: "",
};

// ── Page ──────────────────────────────────────────────────────────────────────

function CvGeneratorPage() {
  const { user } = useAuth();
  const qc       = useQueryClient();
  const search   = Route.useSearch();
  const [query,       setQuery]       = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [filters,     setFilters]     = useState(initialFilters);
  const activeCount = Object.entries(filters).filter(([k, v]) => k !== "sort" && v && v !== "all").length;
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [sendOffice,       setSendOffice]        = useState("");
  const [actionCandidates, setActionCandidates] = useState<Candidate[]>([]);

  const toggleSelect = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSelection = () => setSelected(new Set());

  const sendToOfficeMut = useMutation({
    mutationFn: async ({ ids, office }: { ids: string[]; office: string }) => {
      const { error } = await supabase.from("candidates").update({ cv_sent_to: office, cv_sent_date: new Date().toISOString().split("T")[0] }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, { ids, office }) => {
      toast.success(`CV sent to "${office}" for ${ids.length} candidate${ids.length > 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["cv-candidates"] });
      clearSelection();
      setSendOffice("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["cv-candidates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("candidates").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["cv-templates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cv_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as CvTemplate[];
    },
  });

  const { data: agencyOptions = [] } = useQuery({
    queryKey: ["agencies-offices-names"],
    queryFn: async () => {
      const [agenciesRes, officesRes] = await Promise.all([
        supabase.from("foreign_agencies").select("name").order("name"),
        supabase.from("assignment_offices").select("name").order("name"),
      ]);
      const names = [
        ...(agenciesRes.data ?? []).map((a) => a.name),
        ...(officesRes.data ?? []).map((o) => o.name),
      ];
      return [...new Set(names)].filter((n): n is string => !!n).sort();
    },
  });

  const { data: assignCountries = [] } = useQuery({
    queryKey: ["assignment-countries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("assignment_countries").select("*").order("name");
      if (error) throw error;
      return data as Database["public"]["Tables"]["assignment_countries"]["Row"][];
    },
  });

  const { data: cvDaysThreshold = 7 } = useQuery({
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

  const opts = useMemo(() => {
    const uniq = (k: keyof typeof candidates[0]) =>
      Array.from(new Set(candidates.map((c) => (c[k] as string | null) ?? "").filter(Boolean))).sort();
    return {
      narrative: uniq("narrative"),
    };
  }, [candidates]);

  // Open directly if id param given (e.g. from HR Pool VIEW button)
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current || !search.id || candidates.length === 0) return;
    initialised.current = true;
    const c = candidates.find((x) => x.id === search.id);
    if (c) setActionCandidates([c]);
  }, [search.id, candidates]);

  const filtered = useMemo(() => {
    let list = candidates.filter((c) => c.status === "available");
    if (query) list = list.filter((c) => c.full_name.toLowerCase().includes(query.toLowerCase()));
    if (filters.medical !== "all")      list = list.filter((c) => c.medical_status === filters.medical);
    if (filters.coc !== "all")          list = list.filter((c) => c.coc_status === filters.coc);
    if (filters.gender !== "all")       list = list.filter((c) => c.gender === filters.gender);
    if (filters.religion !== "all")     list = list.filter((c) => c.religion === filters.religion);
    if (filters.narrative !== "all")    list = list.filter((c) => c.narrative === filters.narrative);
    if (filters.experience !== "all")   list = list.filter((c) => c.experience === filters.experience);
    if (filters.musaned !== "all")      list = list.filter((c) => c.musaned_status === filters.musaned);
    if (filters.cv_sent_to !== "all")    list = list.filter((c) => c.cv_sent_to === filters.cv_sent_to);
    if (filters.selected_by !== "all")  list = list.filter((c) => c.selected_by === filters.selected_by);
    if (filters.english_level !== "all") list = list.filter((c) => c.english_level === filters.english_level);
    if (filters.age !== "all") {
      const [min, max] = filters.age.split("-").map(Number);
      list = list.filter((c) => c.age != null && c.age >= min && c.age <= max);
    }
    if (filters.from) list = list.filter((c) => c.created_at >= filters.from);
    if (filters.to)   list = list.filter((c) => c.created_at <= filters.to + "T23:59:59");
    const todayMs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
    const overdueDaysFor = (c: typeof list[0]) => {
      if (!c.cv_sent_to || c.selected_by || !c.cv_sent_date) return -1;
      return Math.floor((todayMs - new Date(c.cv_sent_date + "T00:00:00").getTime()) / 86_400_000);
    };
    list.sort((a, b) => {
      const aDays = overdueDaysFor(a);
      const bDays = overdueDaysFor(b);
      const aOverdue = aDays >= cvDaysThreshold;
      const bOverdue = bDays >= cvDaysThreshold;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      return filters.sort === "newest"
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at);
    });
    return list;
  }, [candidates, query, filters, cvDaysThreshold]);

  const candidateStatus = useMemo(() => {
    const todayMs = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
    const result = new Map<string, { overdueDays?: number; lockedDaysLeft?: number }>();
    for (const c of filtered) {
      if (c.cv_sent_to && !c.selected_by && c.cv_sent_date) {
        const days = Math.floor((todayMs - new Date(c.cv_sent_date + "T00:00:00").getTime()) / 86_400_000);
        if (days >= cvDaysThreshold) {
          result.set(c.id, { overdueDays: days });
        } else {
          result.set(c.id, { lockedDaysLeft: cvDaysThreshold - days });
        }
      }
    }
    return result;
  }, [filtered, cvDaysThreshold]);

  const selectableFiltered = useMemo(
    () => filtered.filter((c) => !candidateStatus.get(c.id)?.lockedDaysLeft),
    [filtered, candidateStatus],
  );

  const allSel  = selectableFiltered.length > 0 && selectableFiltered.every((c) => selected.has(c.id));
  const someSel = !allSel && selectableFiltered.some((c) => selected.has(c.id));

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] mx-[79.6px]">
      <div className="shrink-0 mb-6">
        <PageHeader
          title="CV Page"
          description="Available candidates with Medical Fit and COC Done."
        />
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-2 mb-6 shrink-0">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 rounded-none"
            placeholder="Search candidates…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
          {filtered.length} candidates
        </span>
      </div>

      {/* Filters */}
      <Card className="rounded-none mb-6 shrink-0">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              className="flex items-center gap-2 text-xs font-bold text-foreground hover:text-primary transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
              Filters
              {activeCount > 0 && (
                <span className="rounded-none bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">
                  {activeCount}
                </span>
              )}
              {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <Button
              size="sm" variant="ghost" className="h-7 gap-1 text-xs"
              onClick={() => setFilters(initialFilters)}
              disabled={activeCount === 0}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
          {showFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <CvFilterSelect value={filters.sort} onChange={(v) => setFilters({ ...filters, sort: v })}
                icon={ArrowUpDown}
                options={[{ value: "newest", label: "Date (Newest)" }, { value: "oldest", label: "Date (Oldest)" }]} />
              <CvFilterSelect placeholder="Age" value={filters.age} icon={Users}
                onChange={(v) => setFilters({ ...filters, age: v })}
                options={[
                  { value: "all", label: "-----" },
                  { value: "18-25", label: "18-25" }, { value: "26-35", label: "26-35" },
                  { value: "36-45", label: "36-45" }, { value: "46-99", label: "46+" },
                ]} />
              <CvFilterSelect placeholder="Gender" value={filters.gender} icon={User}
                onChange={(v) => setFilters({ ...filters, gender: v })}
                options={[{ value: "all", label: "-----" }, { value: "Male", label: "Male" }, { value: "Female", label: "Female" }]} />
              <CvFilterSelect placeholder="Religion" value={filters.religion} icon={BookOpen}
                onChange={(v) => setFilters({ ...filters, religion: v })}
                options={[{ value: "all", label: "-----" }, { value: "Muslim", label: "Muslim" }, { value: "Non-muslim", label: "Non-muslim" }]} />
              <CvFilterSelect placeholder="Medical" value={filters.medical} icon={Stethoscope}
                onChange={(v) => setFilters({ ...filters, medical: v })}
                options={[{ value: "all", label: "-----" }, ...MEDICAL_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <CvFilterSelect placeholder="Narrative" value={filters.narrative} icon={FileText}
                onChange={(v) => setFilters({ ...filters, narrative: v })}
                options={[{ value: "all", label: "-----" }, ...opts.narrative.map((o) => ({ value: o, label: o }))]} />
              <CvFilterSelect placeholder="Experience" value={filters.experience} icon={Briefcase}
                onChange={(v) => setFilters({ ...filters, experience: v })}
                options={[{ value: "all", label: "-----" }, { value: "Yes", label: "Yes" }, { value: "No", label: "No" }, { value: "None", label: "None" }]} />
              <CvFilterSelect placeholder="COC" value={filters.coc} icon={FileCheck}
                onChange={(v) => setFilters({ ...filters, coc: v })}
                options={[{ value: "all", label: "-----" }, ...["Done","No","Booked","Placed","Yitazez","Pending Release"].map((o) => ({ value: o, label: o }))]} />
              <CvFilterSelect placeholder="Country" value={filters.musaned} icon={Globe}
                onChange={(v) => setFilters({ ...filters, musaned: v })}
                options={[{ value: "all", label: "-----" }, ...assignCountries.map((c) => ({ value: c.name, label: c.name }))]} />
              <CvFilterSelect placeholder="Selected By" value={filters.selected_by} icon={ClipboardPaste}
                onChange={(v) => setFilters({ ...filters, selected_by: v })}
                options={[{ value: "all", label: "-----" }, ...agencyOptions.map((o) => ({ value: o, label: o }))]} />
              <CvFilterSelect placeholder="CV Sent To" value={filters.cv_sent_to} icon={Send}
                onChange={(v) => setFilters({ ...filters, cv_sent_to: v })}
                options={[{ value: "all", label: "-----" }, ...agencyOptions.map((o) => ({ value: o, label: o }))]} />
              <CvFilterSelect placeholder="English Level" value={filters.english_level} icon={BookOpen}
                onChange={(v) => setFilters({ ...filters, english_level: v })}
                options={[{ value: "all", label: "-----" }, ...["Poor","Little","Fair","Good"].map((o) => ({ value: o, label: o }))]} />
              <CvDateField label="From Date" value={filters.from} onChange={(v) => setFilters({ ...filters, from: v })} />
              <CvDateField label="To Date" value={filters.to} onChange={(v) => setFilters({ ...filters, to: v })} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Select-all + bulk action bar */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between shrink-0 mb-3 px-1">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <Checkbox
              checked={allSel ? true : someSel ? "indeterminate" : false}
              onCheckedChange={(v) => selectableFiltered.forEach((c) => { if (!!v !== selected.has(c.id)) toggleSelect(c.id); })}
            />
            Select all ({selectableFiltered.length}{selectableFiltered.length < filtered.length ? ` of ${filtered.length}` : ""})
          </label>
          {selected.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground shrink-0">{selected.size} selected</span>
              <Select value={sendOffice} onValueChange={setSendOffice}>
                <SelectTrigger className="h-8 w-44 rounded-none text-xs">
                  <SelectValue placeholder="Send CV to office…" />
                </SelectTrigger>
                <SelectContent>
                  {agencyOptions.map((o) => (
                    <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-8 rounded-none"
                disabled={!sendOffice || sendToOfficeMut.isPending}
                onClick={() => {
                  const ids = filtered
                    .filter((c) => selected.has(c.id) && !candidateStatus.get(c.id)?.lockedDaysLeft)
                    .map((c) => c.id);
                  if (ids.length === 0) {
                    toast.info("Selected candidates are still within the requirement period — cannot resend yet");
                    return;
                  }
                  sendToOfficeMut.mutate({ ids, office: sendOffice });
                }}
              >
                <Send className="h-3.5 w-3.5" />
                {sendToOfficeMut.isPending ? "Sending…" : "Send CV"}
              </Button>
              <Button
                size="sm"
                className="gap-2 text-xs h-8 rounded-none"
                onClick={() => {
                  const sel = filtered.filter((c) => selected.has(c.id));
                  if (sel.length > 0) setActionCandidates(sel);
                }}
              >
                <FileText className="h-4 w-4" />
                Action ({selected.size})
              </Button>
              <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs rounded-none" onClick={clearSelection}>
                <X className="h-4 w-4" /> Clear
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Card list */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max space-y-2">
          {filtered.map((c) => {
            const status = candidateStatus.get(c.id);
            return (
              <CvCandidateCard
                key={c.id}
                candidate={c}
                selected={selected.has(c.id)}
                onToggleSelect={() => toggleSelect(c.id)}
                onAction={() => setActionCandidates([c])}
                overdueDays={status?.overdueDays}
                lockedDaysLeft={status?.lockedDaysLeft}
              />
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-16">
              No candidates with Medical Fit and COC Done.
            </div>
          )}
        </div>
      </div>

      {actionCandidates.length > 0 && (
        <BulkActionDialog candidates={actionCandidates} onClose={() => setActionCandidates([])} />
      )}
    </div>
  );
}

function CvFilterSelect({
  value, onChange, options, placeholder, icon: Icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  icon?: React.ElementType;
}) {
  const isReset = value === "all" || !value;
  const hasColor = !isReset && !!OPTION_COLORS[value];
  return (
    <div className="flex items-center gap-0.5">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className={cn(
            "border shadow-none w-auto h-7 px-2 gap-1.5 transition-colors rounded-none text-[13px] font-medium [&>svg]:shrink-0",
            isReset
              ? "bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              : hasColor
                ? cn(OPTION_COLORS[value], "border-transparent")
                : "bg-black/10 border-black/20 text-[#181A27] dark:bg-white/10 dark:border-white/20 dark:text-white",
          )}
        >
          {Icon && <Icon className="h-3 w-3 shrink-0" />}
          {isReset ? (
            <span>{placeholder}</span>
          ) : (
            <span>{options.find((o) => o.value === value)?.label ?? value}</span>
          )}
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!isReset && (
        <button type="button" onClick={() => onChange("all")}
          className="h-7 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground border border-l-0 border-border bg-muted/40 hover:bg-muted transition-colors rounded-none">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function CvDateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const hasValue = !!value;
  const selected = value ? new Date(value + "T00:00:00") : undefined;

  function handleSelect(date: Date | undefined) {
    if (date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      onChange(`${y}-${m}-${d}`);
    } else {
      onChange("");
    }
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-0.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 border shadow-none w-auto h-7 px-2 transition-colors rounded-none text-[13px] font-medium cursor-pointer",
              hasValue
                ? "bg-black/10 border-black/20 text-[#181A27] dark:bg-white/10 dark:border-white/20 dark:text-white"
                : "bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Calendar className="h-3 w-3 shrink-0" />
            <span>{hasValue ? selected?.toLocaleDateString() : label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-none" align="start" side="bottom" sideOffset={6} collisionPadding={16}>
          <CalendarPicker mode="single" selected={selected} onSelect={handleSelect} initialFocus />
        </PopoverContent>
      </Popover>
      {hasValue && (
        <button type="button" onClick={() => onChange("")}
          className="h-7 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground border border-l-0 border-border bg-muted/40 hover:bg-muted transition-colors rounded-none">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
