import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
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

// Field label → candidate value accessor, used both for filling and for the preview field-map
export const CV_FIELD_MAP = (c: Candidate): [string, string][] => [
  ["FULL NAME",      c.full_name                                        ?? ""],
  ["POSITION",       c.occupation                                       ?? ""],
  ["NUMBER",         c.passport_number                                  ?? ""],
  ["DATE OF ISSUE",  c.passport_issue_date                              ?? ""],
  ["DATE OF EXPIRY", c.passport_expiry_date                             ?? ""],
  ["PLACE OF ISSUE", c.place_of_issue ?? c.country                     ?? ""],
  ["ENGLISH",        c.english_level                                    ?? ""],
  ["ARABIC",         c.arabic_level                                     ?? ""],
  ["EXPERIENCE",     c.experience                                       ?? ""],
  ["NATIONALITY",    c.country                                          ?? ""],
  ["RELIGION",       c.religion                                         ?? ""],
  ["DATE OF BIRTH",  c.dob                                             ?? ""],
  ["PLACE OF BIRTH", c.birth_place                                      ?? ""],
  ["LIVING TOWN",    c.living_town                                      ?? ""],
  ["AGE",            c.age      != null ? String(c.age)                 : ""],
  ["MARITAL STATUS", c.marital_status                                   ?? ""],
  ["CHILDREN",       c.children != null ? String(c.children)            : ""],
  ["WEIGHT",         c.weight   != null ? `${c.weight} kg`              : ""],
  ["HEIGHT",         c.height   != null ? `${c.height} cm`              : ""],
  ["REMARK",         c.notes ?? c.remark                               ?? ""],
];

function xmlEsc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Normalize label text: collapse whitespace, strip non-breaking spaces, uppercase
function normLabel(s: string) {
  return s.replace(/[   ]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
}

function cellText(xml: string, from: number, to: number): string {
  let text = "";
  let p = from;
  while (p < to) {
    const idx = xml.indexOf("<w:t", p);
    if (idx === -1 || idx >= to) break;
    // Skip <w:tbl>, <w:tr>, <w:tc*> — only match <w:t> and <w:t<space>
    const ch = xml[idx + 4];
    if (ch !== ">" && ch !== " " && ch !== "\n" && ch !== "\t") { p = idx + 1; continue; }
    const gt = xml.indexOf(">", idx);
    if (gt === -1 || gt >= to) break;
    const close = xml.indexOf("</w:t>", gt + 1);
    if (close === -1 || close >= to) break;
    text += xml.slice(gt + 1, close);
    p = close + 6;
  }
  return text;
}

function nextCell(xml: string, from: number): number {
  let p = from;
  while (p < xml.length) {
    const idx = xml.indexOf("<w:tc", p);
    if (idx === -1) return -1;
    // Skip <w:tcPr>, <w:tcBorders>, etc. — only match <w:tc> and <w:tc<space>
    const ch = xml[idx + 5];
    if (ch === ">" || ch === " " || ch === "\n" || ch === "\t") return idx;
    p = idx + 1;
  }
  return -1;
}

function fillField(xml: string, label: string, value: string): string {
  const normTarget = normLabel(label);
  let pos = 0;
  while (pos < xml.length) {
    const cellStart = nextCell(xml, pos);
    if (cellStart === -1) break;
    const cellEnd = xml.indexOf("</w:tc>", cellStart);
    if (cellEnd === -1) break;

    if (normLabel(cellText(xml, cellStart, cellEnd)) === normTarget) {
      const nStart = nextCell(xml, cellEnd + 7);
      if (nStart === -1) { pos = cellEnd + 7; continue; }
      const nEnd = xml.indexOf("</w:tc>", nStart);
      if (nEnd === -1) { pos = cellEnd + 7; continue; }

      const spaceAttr = value.includes(" ") ? ' xml:space="preserve"' : "";
      let first = true;
      let newCell = xml.slice(nStart, nEnd + 7).replace(
        /<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g,
        (_, attrs) => {
          if (first) {
            first = false;
            return `<w:t${value.includes(" ") ? ' xml:space="preserve"' : (attrs ?? "")}>${xmlEsc(value)}</w:t>`;
          }
          return `<w:t${attrs ?? ""}></w:t>`;
        },
      );
      // If the value cell had no <w:t> at all, inject a run into the first paragraph
      if (first) {
        const pEnd = newCell.indexOf("</w:p>");
        if (pEnd !== -1) {
          newCell = newCell.slice(0, pEnd)
            + `<w:r><w:t${spaceAttr}>${xmlEsc(value)}</w:t></w:r>`
            + newCell.slice(pEnd);
        }
      }
      return xml.slice(0, nStart) + newCell + xml.slice(nEnd + 7);
    }

    pos = cellEnd + 7;
  }
  return xml;
}

async function fetchImgBytes(src: string): Promise<{ bytes: Uint8Array; ext: string } | null> {
  try {
    const r = await fetch(src, { mode: "cors" });
    if (!r.ok) return null;
    const mime = r.headers.get("content-type") ?? "";
    const ext  = mime.includes("png") ? "png" : "jpg";
    return { bytes: new Uint8Array(await r.arrayBuffer()), ext };
  } catch { return null; }
}

function inlineDrawingXml(rId: string, name: string, picId: number, cxEmu: number, cyEmu: number): string {
  return [
    `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing>`,
    `<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"`,
    ` distT="0" distB="0" distL="0" distR="0">`,
    `<wp:extent cx="${cxEmu}" cy="${cyEmu}"/>`,
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>`,
    `<wp:docPr id="${picId}" name="${name}"/>`,
    `<wp:cNvGraphicFramePr>`,
    `<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>`,
    `</wp:cNvGraphicFramePr>`,
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">`,
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`,
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">`,
    `<pic:nvPicPr><pic:cNvPr id="${picId}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>`,
    `<pic:blipFill>`,
    `<a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>`,
    `<a:stretch><a:fillRect/></a:stretch>`,
    `</pic:blipFill>`,
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cxEmu}" cy="${cyEmu}"/></a:xfrm>`,
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`,
    `</pic:pic></a:graphicData></a:graphic></wp:inline>`,
    `</w:drawing></w:r></w:p>`,
  ].join("");
}

function labelParaXml(text: string): string {
  return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${text}</w:t></w:r></w:p>`;
}

export async function buildFilledDocx(url: string, c: Candidate): Promise<Uint8Array> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 100) throw new Error("Template file is empty");
  const zip   = new PizZip(buf);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("word/document.xml missing");
  let xml = new TextDecoder("utf-8").decode(entry.asUint8Array());

  // Fill text fields
  for (const [label, value] of CV_FIELD_MAP(c)) {
    if (!value) continue;
    xml = fillField(xml, label, value);
  }

  // ── Strip ALL existing images from the template ───────────────────────────
  // Templates may have been created from a real CV and still contain that
  // person's photos. Remove every image file and wipe image relationships so
  // only the correct candidate's images appear in the output.
  const imgExts = /\.(jpg|jpeg|png|gif|bmp|webp|tiff|emf|wmf)$/i;
  const mediaFiles = zip.filter((path) => path.startsWith("word/media/") && imgExts.test(path));
  for (const f of mediaFiles) zip.remove(f.name);

  const relsPath  = "word/_rels/document.xml.rels";
  const relsEntry = zip.file(relsPath);
  let relsXml = relsEntry
    ? new TextDecoder().decode(relsEntry.asUint8Array())
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

  // Remove existing image relationships ([^>]* so it matches Target="media/x.jpg" which contains /)
  relsXml = relsXml.replace(
    /<Relationship\b[^>]*Type="[^"]*\/relationships\/image"[^>]*\/>/g, "",
  );

  // Remove any <w:drawing> elements already in the XML (leftover from template)
  xml = xml.replace(/<w:drawing>[\s\S]*?<\/w:drawing>/g, "");

  // ── Add candidate photo + passport scan ───────────────────────────────────
  const imgSources = [
    ...(c.full_photo_url ?? c.photo_url
      ? [{ key: "photo",    src: (c.full_photo_url ?? c.photo_url)!, rId: "rIdCvPhoto",    label: "PHOTO",         cxEmu: 1260000, cyEmu: 1620000 }]
      : []),
    ...(c.passport_scan_url
      ? [{ key: "passport", src: c.passport_scan_url,                rId: "rIdCvPassport", label: "PASSPORT SCAN", cxEmu: 5040000, cyEmu: 3240000 }]
      : []),
  ];

  const embedded: (typeof imgSources[number] & { ext: string })[] = [];
  for (const src of imgSources) {
    const img = await fetchImgBytes(src.src);
    if (!img) continue;
    zip.file(`word/media/cv_${src.key}.${img.ext}`, img.bytes);
    embedded.push({ ...src, ext: img.ext });
  }

  if (embedded.length > 0) {
    for (const src of embedded) {
      relsXml = relsXml.replace(
        "</Relationships>",
        `<Relationship Id="${src.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/cv_${src.key}.${src.ext}"/></Relationships>`,
      );
    }
    zip.file(relsPath, new TextEncoder().encode(relsXml));

    // Ensure [Content_Types].xml declares the image extensions we added
    const ctPath = "[Content_Types].xml";
    const ctEntry = zip.file(ctPath);
    if (ctEntry) {
      let ctXml = new TextDecoder().decode(ctEntry.asUint8Array());
      for (const ext of [...new Set(embedded.map((s) => s.ext))]) {
        if (!ctXml.includes(`Extension="${ext}"`)) {
          const mime = ext === "png" ? "image/png" : "image/jpeg";
          ctXml = ctXml.replace("</Types>", `<Default Extension="${ext}" ContentType="${mime}"/></Types>`);
        }
      }
      zip.file(ctPath, new TextEncoder().encode(ctXml));
    }

    const drawings = embedded.map((src, i) =>
      labelParaXml(src.label) +
      inlineDrawingXml(src.rId, src.label, i + 20, src.cxEmu, src.cyEmu),
    ).join("");
    xml = xml.replace("</w:body>", `<w:p/>` + drawings + "</w:body>");
  } else {
    zip.file(relsPath, new TextEncoder().encode(relsXml));
  }

  zip.file("word/document.xml", new TextEncoder().encode(xml));
  return zip.generate({ type: "uint8array" });
}

function downloadDocx(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
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
  container.style.cssText = "position:fixed;top:0;left:-9999px;";
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => root.render(<CvPreview candidate={c} template={template} />));
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
  const [colsOpen,    setColsOpen]    = useState(true);
  const [docxFormat,  setDocxFormat]  = useState<"docx" | "pdf">("docx");

  const isBulk = candidates.length > 1;
  const preview = candidates[0] ?? null;

  useEffect(() => {
    if (downloadType === "excel-ticket") {
      setSelectedCols(new Set(TICKET_DEFAULT_COLS as string[]));
    }
  }, [downloadType]);

  const allDownloadTypes = [
    ...DOWNLOAD_TYPES,
    ...templates.map((t) => ({ id: t.id, label: t.name, group: "cv" as const })),
  ];

  const currentType     = allDownloadTypes.find((t) => t.id === downloadType) ?? DOWNLOAD_TYPES[3];
  const isCV            = currentType.group === "cv";
  const matchedTemplate = isCV && downloadType !== "normal-cv"
    ? templates.find((t) => t.id === downloadType) ?? null
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
          const isDocxTemplate = !!matchedTemplate && matchedTemplate.file_url.split("?")[0].toLowerCase().endsWith(".docx");
          if (isDocxTemplate) {
            // Bulk DOCX template → one filled DOCX per candidate
            toast.info(`Generating ${candidates.length} DOCX files — please wait…`);
            for (const c of sortedCandidates) {
              const bytes = await buildFilledDocx(matchedTemplate!.file_url, c);
              downloadDocx(bytes, `${c.full_name} — ${currentType.label}.docx`);
            }
            toast.success(`${candidates.length} DOCX files downloaded`);
          } else {
            // Normal CV or PDF template → one PDF per candidate
            toast.info(`Generating ${candidates.length} CVs — please wait…`);
            for (const c of sortedCandidates) {
              const canvas = await candidateToCanvas(c, matchedTemplate);
              const w = canvas.width / 2, h = canvas.height / 2;
              const pdf = new jsPDF({ unit: "px", format: [w, h] });
              pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h);
              pdf.save(`${c.full_name} — ${currentType.label}.pdf`);
            }
            toast.success(`${candidates.length} CVs downloaded`);
          }
        } else {
          // Single CV
          if (matchedTemplate) {
            const isDocx = matchedTemplate.file_url.split("?")[0].toLowerCase().endsWith(".docx");
            if (isDocx && docxFormat === "pdf") {
              // User chose PDF output from a DOCX template — render HTML preview as PDF
              const canvas = await candidateToCanvas(preview!, matchedTemplate);
              const w = canvas.width / 2, h = canvas.height / 2;
              const pdf = new jsPDF({ unit: "px", format: [w, h] });
              pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h);
              pdf.save(`${preview!.full_name} — ${currentType.label}.pdf`);
              toast.success(`${currentType.label} downloaded as PDF`);
            } else if (isDocx) {
              const bytes = await buildFilledDocx(matchedTemplate.file_url, preview!);
              downloadDocx(bytes, `${preview!.full_name} — ${currentType.label}.docx`);
              toast.success(`${currentType.label} downloaded`);
            } else {
              // PDF template — render candidate data via HTML renderer so no old CV info leaks
              const canvas = await candidateToCanvas(preview!, matchedTemplate);
              const w = canvas.width / 2, h = canvas.height / 2;
              const pdf = new jsPDF({ unit: "px", format: [w, h] });
              pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h);
              pdf.save(`${preview!.full_name} — ${currentType.label}.pdf`);
              toast.success(`${currentType.label} downloaded`);
            }
          } else {
            if (downloadType !== "normal-cv")
              toast.info(`No template for "${currentType.label}" — using Normal CV format.`);
            const canvas = await candidateToCanvas(preview!, null);
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
                <span className="text-xs font-bold uppercase tracking-widest text-foreground/70">
                  Sort Options (for Export)
                </span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", sortOpen && "rotate-180")} />
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
                  <span className="text-xs font-medium text-muted-foreground shrink-0">{sortDir.toUpperCase()}</span>
                </div>
              )}
            </div>

            {/* Choose Download Type */}
            <div className="border-b">
              <button type="button" onClick={() => setTypeOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
                <span className="text-xs font-bold uppercase tracking-widest text-foreground/70">
                  Choose Download Type
                </span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", typeOpen && "rotate-180")} />
              </button>
              {typeOpen && (
                <div className="px-4 pb-4 space-y-0.5">
                  {allDownloadTypes.map((t) => (
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
            <div className="border-b flex-1 min-h-0 flex flex-col">
              <button type="button" onClick={() => setColsOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors shrink-0">
                <span className="text-xs font-bold uppercase tracking-widest text-foreground/70">
                  Select Columns
                </span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", colsOpen && "rotate-180")} />
              </button>
              {colsOpen && (
                <div className="px-4 pb-4 overflow-y-auto flex-1">
                  <div className="flex gap-3 mb-3">
                    <button type="button" onClick={() => setSelectedCols(new Set(EXPORT_COLUMNS.map((c) => c.key as string)))}
                      className="text-xs text-primary hover:underline font-medium">All</button>
                    <button type="button" onClick={() => setSelectedCols(new Set())}
                      className="text-xs text-muted-foreground hover:underline">None</button>
                  </div>
                  <div className="space-y-2">
                    {EXPORT_COLUMNS.map((col) => (
                      <label key={col.key as string} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={selectedCols.has(col.key as string)} onCheckedChange={() => toggleCol(col.key as string)} className="rounded-none h-3.5 w-3.5" />
                        <span className="text-xs text-foreground">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right panel — preview */}
          <div className="flex-1 overflow-auto bg-muted/30 p-4">
            {preview && isCV && matchedTemplate ? (
              // DOCX template selected — show field map so user can see what will be filled
              <div className="max-w-lg mx-auto">
                <div className="mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{matchedTemplate.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {matchedTemplate.file_url.split("?")[0].toLowerCase().endsWith(".docx") ? "DOCX" : "PDF"} template
                      {isBulk ? ` · ${candidates.length} candidates` : ""}
                    </p>
                  </div>
                </div>
                <div className="border bg-white divide-y text-xs">
                  {CV_FIELD_MAP(preview).map(([label, value]) => (
                    <div key={label} className={cn("grid grid-cols-2 gap-2 px-3 py-1.5", !value && "opacity-40")}>
                      <span className="font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
                      <span className={cn("text-foreground", !value && "italic")}>{value || "empty"}</span>
                    </div>
                  ))}
                </div>
                {isBulk && (
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    Showing data for {preview.full_name} — all {candidates.length} candidates will be downloaded
                  </p>
                )}
              </div>
            ) : preview && isCV ? (
              <div>
                {isBulk && (
                  <p className="text-xs text-muted-foreground mb-3 text-center">
                    Previewing 1 of {candidates.length} — all candidates will be downloaded
                  </p>
                )}
                <div className="mx-auto w-fit" style={{ zoom: 0.62 }}>
                  <div className="shadow-xl">
                    <CvPreview candidate={preview} template={null} />
                  </div>
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
          <div className="flex items-center gap-3">
            {isCV && downloadType !== "normal-cv" && !matchedTemplate && (
              <p className="text-xs text-muted-foreground">
                No template for &ldquo;{currentType.label}&rdquo; — will download as Normal CV format.
              </p>
            )}
            {isCV && !isBulk && matchedTemplate && matchedTemplate.file_url.split("?")[0].toLowerCase().endsWith(".docx") && (
              <div className="flex items-center border rounded-none overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setDocxFormat("docx")}
                  className={cn(
                    "px-3 py-1.5 font-medium transition-colors",
                    docxFormat === "docx"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  DOCX
                </button>
                <button
                  type="button"
                  onClick={() => setDocxFormat("pdf")}
                  className={cn(
                    "px-3 py-1.5 font-medium transition-colors border-l",
                    docxFormat === "pdf"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  PDF
                </button>
              </div>
            )}
          </div>
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
