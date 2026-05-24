import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { Download, FileText, ArrowUpDown, ChevronDown, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import PizZip from "pizzip";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

export type CvTemplate = Database["public"]["Tables"]["cv_templates"]["Row"];
export type Candidate  = Database["public"]["Tables"]["candidates"]["Row"];

// ── DOCX fill ─────────────────────────────────────────────────────────────────

function xmlEsc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
  let searchFrom = valueCellStart, tOpenStart = -1, tOpenEnd = -1;
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

export async function buildFilledDocxBase64(url: string, c: Candidate): Promise<string> {
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
  return { padding: "5px 9px", border: BORDER, fontSize: 11, fontFamily: "Arial, sans-serif", verticalAlign: "middle", ...extra };
}

function SectionHdr({ en, ar }: { en: string; ar: string }) {
  return (
    <tr>
      <td colSpan={2} style={td({ backgroundColor: BLUE, color: WHITE, fontWeight: "bold", border: "none" })}>{en}</td>
      <td colSpan={2} style={td({ backgroundColor: BLUE, color: LBLUE, textAlign: "right", border: "none", direction: "rtl" })}>{ar}</td>
    </tr>
  );
}

function DataRow({ lbl, val, ar, bg1 = GRAY, bg2 = WHITE, span = false }:
  { lbl: string; val?: string | number | null; ar: string; bg1?: string; bg2?: string; span?: boolean }) {
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

export function CvPreview({ candidate: c, template }: { candidate: Candidate; template: CvTemplate | null }) {
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
            <td colSpan={2} style={{ backgroundColor: NAVY, padding: "14px 16px", border: "none", textAlign: "right", verticalAlign: "middle", direction: "rtl" }}>
              {photo && <img src={photo} alt="" crossOrigin="anonymous" style={{ width: 60, height: 72, objectFit: "cover", float: "left", marginRight: 8, border: "1px solid rgba(255,255,255,0.3)" }} />}
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
          <DataRow lbl="NUMBER"         val={c.passport_number}      ar="رقم الجواز"      bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="DATE OF ISSUE"  val={c.passport_issue_date}  ar="تاريخ الإصدار"   bg1={WHITE} bg2={GRAY}  />
          <DataRow lbl="DATE OF EXPIRY" val={c.passport_expiry_date} ar="تاريخ الانتهاء"  bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="PLACE OF ISSUE" val={c.place_of_issue ?? c.country} ar="مكان الإصدار" bg1={WHITE} bg2={GRAY} />
          <SectionHdr en="LANGUAGE AND EDUCATION  |" ar="اللغة والتعليم" />
          <DataRow lbl="ENGLISH"   val={c.english_level} ar="اللغة الإنجليزية" bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="ARABIC"    val={c.arabic_level}  ar="اللغة العربية"    bg1={WHITE} bg2={GRAY}  />
          <DataRow lbl="EDUCATION" val={c.education}     ar="التعليم"           bg1={GRAY}  bg2={WHITE} />
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
          <DataRow lbl="WEIGHT" val={c.weight != null ? `${c.weight} kg` : ""} ar="الوزن" bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="HEIGHT" val={c.height != null ? `${c.height} cm` : ""} ar="الطول" bg1={WHITE} bg2={GRAY}  />
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

// ── Render a CvPreview to an HTMLCanvasElement (client-side only) ─────────────

async function candidateToCanvas(c: Candidate, template: CvTemplate | null): Promise<HTMLCanvasElement> {
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;top:0;left:-9999px;z-index:-1;";
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(<CvPreview candidate={c} template={template} />);
  await new Promise((r) => setTimeout(r, 250));
  const el = (container.firstElementChild as HTMLElement) ?? container;
  const canvas = await html2canvas(el, {
    scale: 2, backgroundColor: "#ffffff", useCORS: true, allowTaint: false,
    onclone: (_doc, cloned) => {
      _doc.querySelectorAll("link[rel='stylesheet'], style").forEach((s) => s.remove());
      cloned.style.color = "#222222";
      cloned.style.backgroundColor = "#ffffff";
    },
  });
  root.unmount();
  document.body.removeChild(container);
  return canvas;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const DOWNLOAD_TYPES = [
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

export const EXPORT_COLUMNS: { key: keyof Candidate; label: string }[] = [
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

export const TICKET_DEFAULT_COLS: (keyof Candidate)[] = [
  "full_name", "passport_number", "passport_expiry_date",
  "dob", "country", "occupation", "destination_country", "office",
];

export const SORT_FIELDS = [
  { key: "full_name",      label: "Full Name" },
  { key: "occupation",     label: "Occupation" },
  { key: "country",        label: "Nationality" },
  { key: "medical_status", label: "Medical Status" },
  { key: "coc_status",     label: "COC Status" },
  { key: "office",         label: "Office" },
];

// ── ActionDialog ──────────────────────────────────────────────────────────────

interface ActionDialogProps {
  candidates: Candidate[];
  onClose: () => void;
}

export function ActionDialog({ candidates, onClose }: ActionDialogProps) {
  const { user } = useAuth();
  const cvRef   = useRef<HTMLDivElement>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["cv-templates", user?.id],
    enabled: !!user && candidates.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cv_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as CvTemplate[];
    },
  });

  const [downloadType, setDownloadType] = useState("normal-cv");
  const [sortBy,       setSortBy]       = useState("full_name");
  const [sortDir,      setSortDir]      = useState<"asc" | "desc">("asc");
  const [selectedCols, setSelectedCols] = useState<Set<string>>(
    new Set(EXPORT_COLUMNS.map((c) => c.key as string)),
  );
  const [downloading, setDownloading] = useState(false);
  const [sortOpen,    setSortOpen]    = useState(false);
  const [typeOpen,    setTypeOpen]    = useState(true);

  const isBulk = candidates.length > 1;
  const preview = candidates[0] ?? null;

  useEffect(() => {
    if (downloadType === "excel-ticket") {
      setSelectedCols(new Set(TICKET_DEFAULT_COLS as string[]));
    }
  }, [downloadType]);

  const currentType    = DOWNLOAD_TYPES.find((t) => t.id === downloadType)!;
  const isCV           = currentType.group === "cv";
  const matchedTemplate = isCV && downloadType !== "normal-cv"
    ? templates.find((t) =>
        t.name.toLowerCase().includes(currentType.label.toLowerCase().replace(" cv", "").trim()),
      ) ?? null
    : null;

  const toggleCol = (key: string) =>
    setSelectedCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Sort candidates for export
  const sortedCandidates = [...candidates].sort((a, b) => {
    const av = String(a[sortBy as keyof Candidate] ?? "").toLowerCase();
    const bv = String(b[sortBy as keyof Candidate] ?? "").toLowerCase();
    return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const handleDownload = async () => {
    if (candidates.length === 0) return;
    setDownloading(true);
    try {
      if (isCV) {
        if (isBulk) {
          // Bulk CV → multi-page PDF (one page per candidate)
          toast.info(`Generating ${candidates.length} CVs — please wait…`);
          const firstCanvas = await candidateToCanvas(sortedCandidates[0], matchedTemplate);
          const pxW = firstCanvas.width / 2, pxH = firstCanvas.height / 2;
          const pdf = new jsPDF({ unit: "px", format: [pxW, pxH] });
          pdf.addImage(firstCanvas.toDataURL("image/png"), "PNG", 0, 0, pxW, pxH);
          for (let i = 1; i < sortedCandidates.length; i++) {
            const canvas = await candidateToCanvas(sortedCandidates[i], matchedTemplate);
            const w = canvas.width / 2, h = canvas.height / 2;
            pdf.addPage([w, h]);
            pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h);
          }
          pdf.save(`${candidates.length} Candidates — ${currentType.label}.pdf`);
          toast.success(`${currentType.label} — ${candidates.length} pages downloaded`);
        } else {
          // Single CV
          if (matchedTemplate) {
            const isDocx = matchedTemplate.file_url.split("?")[0].toLowerCase().endsWith(".docx");
            if (isDocx) {
              const b64 = await buildFilledDocxBase64(matchedTemplate.file_url, preview!);
              const a = document.createElement("a");
              a.href = `data:application/octet-stream;base64,${b64}`;
              a.download = `${preview!.full_name} — ${currentType.label}.docx`;
              document.body.appendChild(a); a.click(); document.body.removeChild(a);
              toast.success(`${currentType.label} downloaded`);
            } else {
              const res = await fetch(matchedTemplate.file_url);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const blob = new Blob([await res.arrayBuffer()], { type: "application/octet-stream" });
              const url  = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `${preview!.full_name} — ${currentType.label}.pdf`;
              document.body.appendChild(a); a.click(); document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(url), 30_000);
              toast.success(`${currentType.label} downloaded`);
            }
          } else {
            if (downloadType !== "normal-cv")
              toast.info(`No template for "${currentType.label}" — using Normal CV format.`);
            if (!cvRef.current) throw new Error("CV preview not ready — please wait and try again.");
            const canvas = await html2canvas(cvRef.current, {
              scale: 2, backgroundColor: "#ffffff", useCORS: true, allowTaint: false,
              onclone: (_doc, el) => {
                _doc.querySelectorAll("link[rel='stylesheet'], style").forEach((s) => s.remove());
                el.style.color = "#222222"; el.style.backgroundColor = "#ffffff";
              },
            });
            const pxW = canvas.width / 2, pxH = canvas.height / 2;
            const pdf = new jsPDF({ unit: "px", format: [pxW, pxH] });
            pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pxW, pxH);
            pdf.save(`${preview!.full_name} — ${currentType.label}.pdf`);
            toast.success(`${currentType.label} downloaded`);
          }
        }

      } else if (downloadType === "summary-pdf") {
        const cols = EXPORT_COLUMNS.filter((col) => selectedCols.has(col.key as string));
        if (cols.length === 0) throw new Error("Select at least one column to export.");
        const tableEl = document.createElement("div");
        tableEl.style.cssText = "position:absolute;left:-9999px;top:0;width:900px;padding:24px;background:#fff;font-family:Arial,sans-serif";
        const title = isBulk
          ? `${candidates.length} Candidates — Summary`
          : `${preview!.full_name} — Summary`;
        tableEl.innerHTML = `
          <h2 style="margin:0 0 16px;font-size:16px;color:#1a3a52;font-family:Arial,sans-serif">${title}</h2>
          <table style="width:100%;border-collapse:collapse;font-size:10px;font-family:Arial,sans-serif">
            <thead>
              <tr>${cols.map((c) => `<th style="padding:5px 8px;background:#1a3a52;color:#fff;border:1px solid #ccc;text-align:left">${c.label}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${sortedCandidates.map((cand, i) => `
                <tr style="background:${i % 2 === 0 ? "#f8f9fb" : "#fff"}">
                  ${cols.map((col) => `<td style="padding:5px 8px;border:1px solid #ddd">${String(cand[col.key] ?? "—")}</td>`).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>`;
        document.body.appendChild(tableEl);
        const canvas = await html2canvas(tableEl, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
        document.body.removeChild(tableEl);
        const pxW = canvas.width / 2, pxH = canvas.height / 2;
        const pdf = new jsPDF({ unit: "px", format: [pxW, pxH] });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pxW, pxH);
        const fileName = isBulk ? `${candidates.length} Candidates — Summary.pdf` : `${preview!.full_name} — Summary.pdf`;
        pdf.save(fileName);
        toast.success("Summary PDF downloaded");

      } else {
        // Excel / Excel for Ticket → .xlsx
        const cols = EXPORT_COLUMNS.filter((col) => selectedCols.has(col.key as string));
        if (cols.length === 0) throw new Error("Select at least one column to export.");
        const header = cols.map((col) => col.label);
        const rows   = sortedCandidates.map((cand) =>
          cols.map((col) => {
            const v = cand[col.key];
            return v == null ? "" : typeof v === "number" ? v : String(v);
          }),
        );
        const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
        ws["!cols"] = header.map((h, i) => ({
          wch: Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length), 10),
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Candidates");
        const buf  = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url  = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const fileName = isBulk
          ? `${candidates.length} Candidates — ${currentType.label}.xlsx`
          : `${preview!.full_name} — ${currentType.label}.xlsx`;
        a.href = url; a.download = fileName;
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

  const title = isBulk
    ? `Action — ${candidates.length} candidates selected`
    : `Action — ${preview?.full_name ?? ""}`;

  return (
    <Dialog open={candidates.length > 0} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="rounded-none p-0 gap-0 overflow-hidden"
        style={{ maxWidth: 1400, width: "98vw", maxHeight: "92vh", display: "flex", flexDirection: "column" }}
      >
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            {isBulk && <Users className="h-4 w-4 text-primary" />}
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left panel */}
          <div className="w-[360px] shrink-0 border-r flex flex-col overflow-y-auto">

            {/* Sort Options */}
            <div className="border-b">
              <button type="button" onClick={() => setSortOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sort Options (for Export)
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", sortOpen && "rotate-180")} />
              </button>
              {sortOpen && (
                <div className="px-4 pb-4 flex items-center gap-2">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-8 text-xs rounded-none flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SORT_FIELDS.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <button type="button" onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
                    className="h-8 w-8 shrink-0 flex items-center justify-center border rounded-none text-muted-foreground hover:bg-muted">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[10px] text-muted-foreground shrink-0">{sortDir.toUpperCase()}</span>
                </div>
              )}
            </div>

            {/* Choose Download Type */}
            <div className="border-b">
              <button type="button" onClick={() => setTypeOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Choose Download Type
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", typeOpen && "rotate-180")} />
              </button>
              {typeOpen && (
                <div className="px-4 pb-4 space-y-0.5">
                  {DOWNLOAD_TYPES.map((t) => (
                    <button key={t.id} type="button" onClick={() => setDownloadType(t.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm rounded-none border transition-colors",
                        downloadType === t.id
                          ? "border-primary/40 bg-primary/5 text-primary font-medium"
                          : "border-transparent hover:border-border hover:bg-muted/40 text-muted-foreground",
                      )}>
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Select Columns */}
            <div className="p-4 flex-1 min-h-0">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Select Columns</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSelectedCols(new Set(EXPORT_COLUMNS.map((c) => c.key as string)))}
                    className="text-[9px] text-primary hover:underline">All</button>
                  <button type="button" onClick={() => setSelectedCols(new Set())}
                    className="text-[9px] text-muted-foreground hover:underline">None</button>
                </div>
              </div>
              <div className="space-y-1.5">
                {EXPORT_COLUMNS.map((col) => (
                  <label key={col.key as string} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={selectedCols.has(col.key as string)} onCheckedChange={() => toggleCol(col.key as string)} className="rounded-none h-3.5 w-3.5" />
                    <span className="text-xs text-foreground">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel — preview */}
          <div className="flex-1 overflow-auto bg-muted/30 p-4">
            {preview && isCV ? (
              <div>
                {isBulk && (
                  <p className="text-xs text-muted-foreground mb-3 text-center">
                    Previewing 1 of {candidates.length} — all candidates will be downloaded
                  </p>
                )}
                <div ref={cvRef} className="mx-auto shadow-xl w-fit">
                  <CvPreview candidate={preview} template={matchedTemplate} />
                </div>
              </div>
            ) : preview ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <FileText className="h-14 w-14 opacity-15" />
                <p className="text-sm font-medium">{currentType.label}</p>
                <p className="text-xs opacity-60 text-center max-w-[260px]">
                  {downloadType === "summary-pdf"
                    ? `A PDF table will be generated for ${isBulk ? `all ${candidates.length} candidates` : "this candidate"} with the selected columns.`
                    : `An Excel (.xlsx) spreadsheet will be generated for ${isBulk ? `all ${candidates.length} candidates` : "this candidate"} with the selected columns.`}
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
          ) : <span />}
          <Button onClick={handleDownload} disabled={downloading} className="rounded-none shrink-0">
            <Download className="h-4 w-4 mr-2" />
            {downloading
              ? "Downloading…"
              : isBulk
                ? `Download ${candidates.length} × ${currentType.label}`
                : `Download — ${currentType.label}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
