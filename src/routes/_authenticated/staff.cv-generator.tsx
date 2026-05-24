import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Search, Download, FileText, User, ArrowUpDown, ChevronDown, Send, ClipboardPaste, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
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

function fillField(xml: string, label: string, value: string): string {
  const marker = ">" + label + "</w:t>";
  const pos = xml.indexOf(marker);
  if (pos === -1) return xml;
  const cellClose = xml.indexOf("</w:tc>", pos + marker.length);
  if (cellClose === -1) return xml;
  const valueCellStart = xml.indexOf("<w:tc", cellClose + 7);
  if (valueCellStart === -1) return xml;
  const valueCellEnd = xml.indexOf("</w:tc>", valueCellStart);
  if (valueCellEnd === -1) return xml;
  let searchFrom = valueCellStart;
  let tOpenStart = -1, tOpenEnd = -1;
  while (searchFrom < valueCellEnd) {
    const idx = xml.indexOf("<w:t", searchFrom);
    if (idx === -1 || idx >= valueCellEnd) break;
    const ch = xml[idx + 4];
    if (ch === ">" || ch === " " || ch === "\n" || ch === "\t") {
      tOpenStart = idx; tOpenEnd = xml.indexOf(">", tOpenStart); break;
    }
    searchFrom = idx + 1;
  }
  if (tOpenStart === -1 || tOpenEnd === -1 || tOpenEnd >= valueCellEnd) return xml;
  const tClose = xml.indexOf("</w:t>", tOpenEnd + 1);
  if (tClose === -1 || tClose >= valueCellEnd) return xml;
  return xml.slice(0, tOpenEnd + 1) + xmlEsc(value) + xml.slice(tClose);
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
  candidate: c, selected, onToggleSelect, onAction,
}: { candidate: Candidate; selected: boolean; onToggleSelect: () => void; onAction: () => void }) {
  type FieldDef = { label: string; value: string; bold?: boolean; badge?: boolean };
  const fields: FieldDef[] = [
    { label: "FULL NAME",      value: c.full_name,                                                   bold: true },
    { label: "CANDIDATE CODE", value: c.candidate_code ?? "—" },
    { label: "GENDER",         value: c.gender ?? "—" },
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
  ];

  return (
    <Card className={cn("relative overflow-visible transition-colors rounded-none mx-[5px]", selected && "ring-2 ring-primary")}>
      <span className="absolute -top-2 left-3 rounded-none px-1.5 py-0.5 text-[10px] font-semibold tracking-wide bg-success text-success-foreground">
        Available
      </span>
      <CardContent className="p-0">
        <div className="grid grid-cols-[20px_40px_1fr_auto] gap-3 items-center">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="ml-3" />
          <Avatar className="h-10 w-10">
            {c.photo_url && <AvatarImage src={c.photo_url} alt={c.full_name} />}
            <AvatarFallback className="text-[10px]">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>

          <div className="overflow-x-auto no-scrollbar">
            <div className="flex gap-5 items-start py-3">
              {fields.map((f) => (
                <div key={f.label} className="shrink-0">
                  <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase whitespace-nowrap mb-[5px]">
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
                      "text-[14px] text-[#181A27] whitespace-nowrap dark:text-foreground",
                      f.bold && "font-semibold",
                    )}>
                      {f.value}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 pt-[10px] pr-[12px] pb-[10px] pl-[4px]">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[12px] px-2 rounded-none whitespace-nowrap"
              onClick={onAction}
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Action
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
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

// ── Page ──────────────────────────────────────────────────────────────────────

function CvGeneratorPage() {
  const { user } = useAuth();
  const qc       = useQueryClient();
  const search   = Route.useSearch();
  const [query,            setQuery]            = useState("");
  const [filterSelectedBy, setFilterSelectedBy] = useState("all");
  const [filterCvSentTo,   setFilterCvSentTo]   = useState("all");
  const [unsentOnly,       setUnsentOnly]        = useState(false);
  const [selected,         setSelected]         = useState<Set<string>>(new Set());
  const [sendOffice,       setSendOffice]        = useState("");
  const [actionCandidates, setActionCandidates] = useState<Candidate[]>([]);

  const toggleSelect = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSelection = () => setSelected(new Set());

  const sendToOfficeMut = useMutation({
    mutationFn: async ({ ids, office }: { ids: string[]; office: string }) => {
      const { error } = await supabase.from("candidates").update({ cv_sent_to: office }).in("id", ids);
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

  // Open directly if id param given (e.g. from HR Pool VIEW button)
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current || !search.id || candidates.length === 0) return;
    initialised.current = true;
    const c = candidates.find((x) => x.id === search.id);
    if (c) setActionCandidates([c]);
  }, [search.id, candidates]);

  const filtered = candidates.filter((c) =>
    c.status === "available" &&
    c.medical_status === "Fit" &&
    c.coc_status === "Done" &&
    (!unsentOnly || !c.cv_sent_to) &&
    (!query || c.full_name.toLowerCase().includes(query.toLowerCase())) &&
    (filterSelectedBy === "all" || (filterSelectedBy === "__unset__" ? !c.selected_by : c.selected_by === filterSelectedBy)) &&
    (filterCvSentTo   === "all" || (filterCvSentTo   === "__unset__" ? !c.cv_sent_to  : c.cv_sent_to  === filterCvSentTo)),
  );

  const allSel  = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const someSel = !allSel && filtered.some((c) => selected.has(c.id));

  return (
    <div className="flex flex-col h-[calc(100vh-112px)]">
      <div className="shrink-0 mb-4">
        <PageHeader
          title="CV Page"
          description="Available candidates with Medical Fit and COC Done."
        />
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3 shrink-0">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 rounded-none"
            placeholder="Search candidates…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={filterSelectedBy} onValueChange={setFilterSelectedBy}>
          <SelectTrigger className="h-9 w-48 rounded-none text-xs gap-1">
            <ClipboardPaste className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Selected By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Selected By</SelectItem>
            <SelectItem value="__unset__" className="text-xs text-muted-foreground">— Not set</SelectItem>
            {agencyOptions.map((o) => (
              <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCvSentTo} onValueChange={setFilterCvSentTo}>
          <SelectTrigger className="h-9 w-48 rounded-none text-xs gap-1">
            <Send className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <SelectValue placeholder="CV Sent To" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All CV Sent To</SelectItem>
            <SelectItem value="__unset__" className="text-xs text-muted-foreground">— Not set</SelectItem>
            {agencyOptions.map((o) => (
              <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={() => setUnsentOnly((v) => !v)}
          className={cn(
            "h-9 px-3 rounded-none border text-xs font-medium transition-colors shrink-0 flex items-center gap-1.5",
            unsentOnly
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
          )}
        >
          <Send className="h-3.5 w-3.5" />
          Unsent only
          {unsentOnly && <X className="h-3 w-3 ml-0.5" />}
        </button>
        <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
          {filtered.length} candidates
        </span>
      </div>

      {/* Select-all + bulk action bar */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between shrink-0 mb-2 px-1">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <Checkbox
              checked={allSel ? true : someSel ? "indeterminate" : false}
              onCheckedChange={(v) => filtered.forEach((c) => { if (!!v !== selected.has(c.id)) toggleSelect(c.id); })}
            />
            Select all ({filtered.length})
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
                  const ids = filtered.filter((c) => selected.has(c.id)).map((c) => c.id);
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
      <div className="flex-1 overflow-y-auto space-y-6 pr-1 pt-1">
        {filtered.map((c) => (
          <CvCandidateCard
            key={c.id}
            candidate={c}
            selected={selected.has(c.id)}
            onToggleSelect={() => toggleSelect(c.id)}
            onAction={() => setActionCandidates([c])}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-16">
            No candidates with Medical Fit and COC Done.
          </div>
        )}
      </div>

      {actionCandidates.length > 0 && (
        <BulkActionDialog candidates={actionCandidates} onClose={() => setActionCandidates([])} />
      )}
    </div>
  );
}
