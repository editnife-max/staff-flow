import PizZip from "pizzip";
import type { Database } from "@/integrations/supabase/types";

export type CvTemplate = Database["public"]["Tables"]["cv_templates"]["Row"];
export type Candidate  = Database["public"]["Tables"]["candidates"]["Row"];

// Metadata stored by optimizeCvTemplate: Claude's field mapping + image slot positions
interface TemplateMetadata {
  fieldMap?: Record<string, string>;
  imageSlots?: Array<{
    rId: string;
    target: string;
    cx: number;
    cy: number;
    anchorType: string;
    purpose: "photo" | "fullphoto" | "passport" | "unknown";
  }>;
  imageCells?: Array<{ label: string; purpose: "photo" | "fullphoto" | "passport" }>;
}

function getCandidateFieldValue(c: Candidate, field: string): string {
  const m: Record<string, string> = {
    FULL_NAME:            c.full_name                              ?? "",
    POSITION:             c.occupation                            ?? "",
    PASSPORT_NUMBER:      c.passport_number                       ?? "",
    PASSPORT_ISSUE_DATE:  c.passport_issue_date                   ?? "",
    PASSPORT_EXPIRY_DATE: c.passport_expiry_date                  ?? "",
    PLACE_OF_ISSUE:       c.place_of_issue ?? c.country           ?? "",
    ENGLISH_LEVEL:        c.english_level                         ?? "",
    ARABIC_LEVEL:         c.arabic_level                          ?? "",
    EXPERIENCE:           c.experience                            ?? "",
    NATIONALITY:          c.country                               ?? "",
    RELIGION:             c.religion                              ?? "",
    DATE_OF_BIRTH:        c.dob                                   ?? "",
    PLACE_OF_BIRTH:       c.birth_place                           ?? "",
    LIVING_TOWN:          c.living_town                           ?? "",
    AGE:                  c.age      != null ? String(c.age)      : computeAge(c.dob),
    MARITAL_STATUS:       c.marital_status                        ?? "",
    CHILDREN:             c.children != null ? String(c.children) : "",
    EDUCATION:            c.education                             ?? "",
    WEIGHT:               c.weight   != null ? `${c.weight} kg`   : "",
    HEIGHT:               c.height   != null ? `${c.height} cm`   : "",
    REMARK:               c.notes ?? c.remark                    ?? "",
    LABOUR_ID:            c.labour_id                             ?? "",
    NARRATIVE:            c.narrative                             ?? "",
    MEDICAL_STATUS:       c.medical_status                        ?? "",
    TASHEER_DATE:         c.tasheer_date                          ?? "",
    TASHEER_STATUS:       c.tasheer_status                        ?? "",
    NARRATIVE_PHONE:      c.narrative_phone                       ?? "",
    COC_STATUS:           c.coc_status                            ?? "",
    TICKET_STATUS:        c.ticket_status                         ?? "",
    TICKET_DATE:          c.ticket_date                           ?? "",
    LMIS_STATUS:          c.lmis_status                           ?? "",
    WOKALA_STATUS:        c.wokala_status                         ?? "",
    COC_PHONE:            c.coc_agency_phone                      ?? "",
    CV_SENT_TO:           c.cv_sent_to                            ?? "",
    CV_SENT_DATE:         c.cv_sent_date                          ?? "",
    MEDICAL_DAYS:         c.medical_days                          ?? "",
    EXPERIENCE_COUNTRY:   c.experience_country                    ?? "",
    VISA_STATUS:          c.visa_status                           ?? "",
    SELECTED_BY:          c.selected_by                           ?? "",
    OFFICE:               c.office                                ?? "",
    EMBASSY_DATE:         c.embassy_date                          ?? "",
    ARRIVAL_CITY:         c.arrival_city                          ?? "",
    INSURANCE_STATUS:     c.insurance_status                      ?? "",
    INSURANCE_DATE:       c.insurance_date                        ?? "",
    MEDICAL_DATE:         c.medical_date                          ?? "",
    CONTRACT_DATE:        c.contract_date                         ?? "",
    DESTINATION_COUNTRY:  c.destination_country                   ?? "",
    EXPERIENCE_YEARS:     c.experience_years                      ?? "",
    GENDER:               c.gender                                ?? "",
    MUSANED_STATUS:       c.musaned_status                        ?? "",
    PASSPORT_STATUS:      c.passport_status                       ?? "",
    SERIAL_NUMBER:        c.serial_number ?? c.candidate_code     ?? "",
    CANDIDATE_CODE:       c.candidate_code ?? c.serial_number     ?? "",
    SKILLS:               c.skills                                ?? "",
    SPOKEN_LANGUAGES:     c.spoken_languages                      ?? "",
    COC_AGENCY_NAME:      c.coc_agency_name                       ?? "",
    EMERGENCY_CONTACT:    c.emergency_contact                     ?? "",
  };
  return m[field] ?? "";
}

export const CV_FIELD_MAP = (c: Candidate): [string, string][] => [
  ["FULL NAME",          c.full_name                                        ?? ""],
  ["POSITION",           c.occupation                                       ?? ""],
  ["NUMBER",             c.passport_number                                  ?? ""],
  ["DATE OF ISSUE",      c.passport_issue_date                              ?? ""],
  ["DATE OF EXPIRY",     c.passport_expiry_date                             ?? ""],
  ["PLACE OF ISSUE",     c.place_of_issue ?? c.country                     ?? ""],
  ["ENGLISH",            c.english_level                                    ?? ""],
  ["ARABIC",             c.arabic_level                                     ?? ""],
  ["EDUCATION",          c.education                                        ?? ""],
  ["EXPERIENCE",         c.experience                                       ?? ""],
  ["NATIONALITY",        c.country                                          ?? ""],
  ["RELIGION",           c.religion                                         ?? ""],
  ["DATE OF BIRTH",      c.dob                                             ?? ""],
  ["PLACE OF BIRTH",     c.birth_place                                      ?? ""],
  ["LIVING TOWN",        c.living_town                                      ?? ""],
  ["AGE",                c.age      != null ? String(c.age)                 : computeAge(c.dob)],
  ["MARITAL STATUS",     c.marital_status                                   ?? ""],
  ["CHILDREN",           c.children != null ? String(c.children)            : ""],
  ["WEIGHT",             c.weight   != null ? `${c.weight} kg`              : ""],
  ["HEIGHT",             c.height   != null ? `${c.height} cm`              : ""],
  ["REMARK",             c.notes ?? c.remark                               ?? ""],
  ["LABOUR ID",          c.labour_id                                        ?? ""],
  ["NARRATIVE",          c.narrative                                        ?? ""],
  ["MEDICAL STATUS",     c.medical_status                                   ?? ""],
  ["TASHEER DATE",       c.tasheer_date                                     ?? ""],
  ["TASHEER",            c.tasheer_status                                   ?? ""],
  ["NARRATIVE PHONE",    c.narrative_phone                                  ?? ""],
  ["COC STATUS",         c.coc_status                                       ?? ""],
  ["TICKET",             c.ticket_status                                    ?? ""],
  ["TICKET DATE",        c.ticket_date                                      ?? ""],
  ["KUWAIT TICKET DATE", c.ticket_date                                      ?? ""],
  ["SAUDI TICKET DATE",  c.ticket_date                                      ?? ""],
  ["LMIS",               c.lmis_status                                      ?? ""],
  ["WOKALA",             c.wokala_status                                    ?? ""],
  ["COC PHONE",          c.coc_agency_phone                                 ?? ""],
  ["CV SENT TO",         c.cv_sent_to                                       ?? ""],
  ["CV SENT DATE",       c.cv_sent_date                                     ?? ""],
  ["MEDICAL DAYS",       c.medical_days                                     ?? ""],
  ["EXPERIENCE OUTSIDE", c.experience_country                               ?? ""],
  ["VISA STATUS",        c.visa_status                                      ?? ""],
  ["SELECTED BY",        c.selected_by                                      ?? ""],
  ["INSIDE OFFICE",      c.office                                           ?? ""],
  ["EMBASSY DATE",           c.embassy_date                                 ?? ""],
  ["ARRIVAL CITY",           c.arrival_city                                 ?? ""],
  ["INSURANCE",              c.insurance_status                             ?? ""],
  ["INSURANCE STATUS",       c.insurance_status                             ?? ""],
  ["INSURANCE DATE",         c.insurance_date                               ?? ""],
  ["MEDICAL DATE",           c.medical_date                                 ?? ""],
  ["CONTRACT DATE",          c.contract_date                                ?? ""],
  ["DESTINATION COUNTRY",    c.destination_country                          ?? ""],
  ["COUNTRY OF WORK",        c.destination_country                          ?? ""],
  ["GOING COUNTRY",          c.destination_country                          ?? ""],
  ["EXPERIENCE YEARS",       c.experience_years                             ?? ""],
  ["YEARS OF EXPERIENCE",    c.experience_years                             ?? ""],
  ["GENDER",                 c.gender                                       ?? ""],
  ["MUSANED",                c.musaned_status                               ?? ""],
  ["MUSANED STATUS",         c.musaned_status                               ?? ""],
  ["PASSPORT STATUS",        c.passport_status                              ?? ""],
  ["SERIAL NUMBER",          c.serial_number ?? c.candidate_code            ?? ""],
  ["SERIAL NO",              c.serial_number ?? c.candidate_code            ?? ""],
  ["CANDIDATE CODE",         c.candidate_code ?? c.serial_number            ?? ""],
  ["CODE",                   c.candidate_code ?? c.serial_number            ?? ""],
  ["SKILLS",                 c.skills                                       ?? ""],
  ["SPOKEN LANGUAGES",       c.spoken_languages                             ?? ""],
  ["LANGUAGES",              c.spoken_languages                             ?? ""],
  ["COC AGENCY",             c.coc_agency_name                              ?? ""],
  ["COC AGENCY NAME",        c.coc_agency_name                              ?? ""],
  ["EMERGENCY CONTACT",      c.emergency_contact                            ?? ""],
  // ── Label variants found in the 4 seeded templates ───────────────────────
  ["NAME",                   c.full_name                                    ?? ""],
  ["NAME IN FULL",           c.full_name                                    ?? ""],
  ["PASSPORT NO",            c.passport_number                              ?? ""],
  ["PASSPORT NUMBER",        c.passport_number                              ?? ""],
  ["PROFESSION",             c.occupation                                   ?? ""],
  ["POSITION APPLIED",       c.occupation                                   ?? ""],
  ["POST APPLIED FOR",       c.occupation                                   ?? ""],
  ["DATE OF EXP",            c.passport_expiry_date                         ?? ""],
  ["ENGLISH LANGUAGE",       c.english_level                                ?? ""],
  ["EDUCATIONAL QUALIFICATION", c.education                                 ?? ""],
  ["NO OF KIDS",             c.children != null ? String(c.children)        : ""],
  ["NO OF CHILDREN",         c.children != null ? String(c.children)        : ""],
  ["PERMANENT ADDRESS",      c.living_town                                  ?? ""],
  ["ADDRESS",                c.living_town                                  ?? ""],
  ["ADRESS",                 c.living_town                                  ?? ""],
  ["NOTES",                  c.notes ?? c.remark                           ?? ""],
  ["NOTE",                   c.notes ?? c.remark                           ?? ""],
  ["REF NO",                 c.serial_number ?? c.candidate_code            ?? ""],
  ["REG NO",                 c.serial_number ?? c.candidate_code            ?? ""],
  ["CONTACT NO",             c.narrative_phone ?? c.emergency_contact       ?? ""],
  ["HOUSE MAID MOB",         c.narrative_phone ?? c.emergency_contact       ?? ""],
  ["COUNTRY",                c.experience_country                           ?? ""],
  ["HIGHEST EDUCATIONAL LEVEL", c.education                                 ?? ""],
  ["DATE OF BIRTH & AGE",    (c.dob ?? "") + ((c.age != null ? String(c.age) : computeAge(c.dob)) ? " " + (c.age != null ? String(c.age) : computeAge(c.dob)) : "")],
];

// ── Arabic value translations ─────────────────────────────────────────────────
const AR_OCCUPATION: Record<string, string> = {
  "HOUSEMAID": "عاملة منزلية", "HOUSE MAID": "عاملة منزلية",
  "DOMESTIC WORKER": "عاملة منزلية", "HOUSEKEEPER": "عاملة منزلية",
  "COOK": "طباخة", "BABY SITTER": "مربية أطفال", "BABYSITTER": "مربية أطفال",
  "NURSE": "ممرضة", "CAREGIVER": "مقدمة رعاية", "CLEANER": "عاملة نظافة",
  "DRIVER": "سائق", "GARDENER": "بستاني",
};
const AR_RELIGION: Record<string, string> = {
  "MUSLIM": "مسلمة", "ISLAM": "مسلمة",
  "CHRISTIAN": "مسيحية", "CHRISTIANITY": "مسيحية",
  "HINDU": "هندوسية", "BUDDHIST": "بوذية",
};
const AR_MARITAL: Record<string, string> = {
  "MARRIED": "متزوجة", "SINGLE": "عزباء",
  "DIVORCED": "مطلقة", "WIDOWED": "أرملة", "WIDOW": "أرملة",
};
const AR_EDUCATION: Record<string, string> = {
  "PRIMARY": "إبتدائي", "ELEMENTARY": "إبتدائي",
  "SECONDARY": "ثانوي", "HIGH SCHOOL": "ثانوي",
  "UNIVERSITY": "جامعي", "BACHELOR": "جامعي",
  "DIPLOMA": "دبلوم", "ILLITERATE": "أمية", "NO EDUCATION": "أمية",
  "MIDDLE": "متوسط", "JUNIOR": "متوسط",
};
const AR_EXPERIENCE: Record<string, string> = {
  "FIRST TIME": "لم يسبق لها العمل", "NO EXPERIENCE": "لم يسبق لها العمل",
  "EXPERIENCED": "لديها خبرة",
};
const AR_LEVEL: Record<string, string> = {
  "EXCELLENT": "ممتاز", "VERY GOOD": "جيد جداً", "GOOD": "جيد",
  "FAIR": "مقبول", "AVERAGE": "مقبول", "POOR": "ضعيف",
  "BASIC": "ضعيف", "NONE": "لا يوجد", "NO": "لا يوجد",
};

function toArabic(value: string | null | undefined, map: Record<string, string>): string {
  if (!value) return "";
  return map[value.trim().toUpperCase()] ?? "";
}

// CV_ARABIC_FIELD_MAP: RTL label cells whose value cell is BEFORE them in XML order.
// Processed with fillFieldBefore() so the cell immediately preceding the label is filled.
export const CV_ARABIC_FIELD_MAP = (c: Candidate): [string, string][] => [
  ["المهنة",             toArabic(c.occupation,     AR_OCCUPATION)],
  ["الخبرة",             toArabic(c.experience,     AR_EXPERIENCE)],
  ["اللغة العربية",      c.arabic_level                          ?? ""],
  ["الديانة",            toArabic(c.religion,       AR_RELIGION)],
  ["الدرجة التعليمية",   toArabic(c.education,      AR_EDUCATION)],
  ["الحالة الاجتماعية",  toArabic(c.marital_status, AR_MARITAL)],
  ["عدد الأطفال",        c.children != null ? String(c.children) : ""],
  ["الوزن",              c.weight   != null ? `${c.weight} kg`   : ""],
  ["الطول",              c.height   != null ? `${c.height} cm`   : ""],
  ["العمر",              c.age      != null ? String(c.age)      : computeAge(c.dob)],
  ["تاريخ الميلاد",      c.dob                                   ?? ""],
];

function computeAge(dob: string | null | undefined): string {
  if (!dob) return "";
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? String(age) : "";
}

function xmlEsc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function xmlEscAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Normalize label text: decode XML entities, collapse whitespace, uppercase,
// strip trailing punctuation (":", ".") and abbreviation dots ("No. " → "NO ").
function normLabel(s: string) {
  return s
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"')
    .replace(/[   ]/g, " ")  // normalize non-breaking/ideographic spaces
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .replace(/\.\s+/g, " ") // "No. " → "NO ", "Jan. " → "JAN "
    .replace(/[.:]+$/, "")  // strip trailing ":", ".", ".:", etc.
    .replace(/\s+/g, " ")
    .trim();
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

// Depth-counted cell-end: finds the </w:tc> that closes the cell opened at cellStart,
// correctly skipping over </w:tc> tags that belong to nested tables inside the cell.
// Falls back to a plain indexOf result if depth-counting fails (malformed XML).
function outerCellEnd(xml: string, cellStart: number): number {
  let depth = 1;
  let scan = cellStart + 5;
  while (depth > 0 && scan < xml.length) {
    const nextOpen  = xml.indexOf("<w:tc",  scan);
    const nextClose = xml.indexOf("</w:tc>", scan);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      const ch = xml[nextOpen + 5];
      if (ch === ">" || ch === " " || ch === "\n" || ch === "\t") depth++;
      scan = nextOpen + 5;
    } else {
      depth--;
      if (depth === 0) return nextClose;
      scan = nextClose + 7;
    }
  }
  return xml.indexOf("</w:tc>", cellStart); // fallback
}

// Adds bold to every run in a cell's XML and strips explicit color overrides
// (so red/colored template text becomes default black after fill).
// Strips existing <w:b> / <w:bCs> first to avoid duplicates, then injects
// them before every </w:rPr>. Also handles runs that have no <w:rPr> at all.
function boldifyCell(cellXml: string): string {
  let result = cellXml
    .replace(/<w:b\b[^/]*\/>/g, "")
    .replace(/<w:bCs\b[^/]*\/>/g, "")
    .replace(/<w:color\b[^/]*\/>/g, "");
  result = result.replace(/<\/w:rPr>/g, "<w:b/><w:bCs/></w:rPr>");
  result = result.replace(/(<w:r(?:\s[^>]*)?>)(?!\s*<w:rPr)/g,
    (_, openTag) => `${openTag}<w:rPr><w:b/><w:bCs/></w:rPr>`);
  return result;
}

// Applies center-alignment to every paragraph in a cell's XML.
// Removes any existing <w:jc> alignment and <w:ind> indentation (which would
// offset center-aligned text), then inserts <w:jc w:val="center"/> before
// each </w:pPr>. For paragraphs that lack <w:pPr>, inserts one.
function centerAlignCell(cellXml: string): string {
  // Remove existing <w:jc .../> and <w:ind .../> self-closing elements
  let result = cellXml
    .replace(/<w:jc\b[^/]*\/>/g, "")
    .replace(/<w:jc\b[\s\S]*?<\/w:jc>/g, "")
    .replace(/<w:ind\b[^/]*\/>/g, "");
  // Inject center alignment before every </w:pPr>
  result = result.replace(/<\/w:pPr>/g, '<w:jc w:val="center"/></w:pPr>');
  // Handle paragraphs that have no <w:pPr> at all: add one after <w:p ...>
  result = result.replace(/(<w:p(?:\s[^>]*)?>)(?!\s*<w:pPr)/g,
    (_, openTag) => openTag + '<w:pPr><w:jc w:val="center"/></w:pPr>');
  return result;
}

// Fills the 3 value cells that precede an anchor label cell in the same row.
// Used for the Jawa template's Row-3/Row-4 layout where Religion, Height, Weight
// labels are in Row 3 but their values are in Row 4 — immediately before "Monthly Salary".
// cells[anchorIndex - 3] = religion, [anchorIndex - 2] = height, [anchorIndex - 1] = weight.
function fillJawaSpecialRow(
  xml: string,
  religion: string,
  height: string,
  weight: string,
  opts?: { bold?: boolean },
): string {
  const ANCHOR = "MONTHLY SALARY";
  let anchorStart = -1;
  let p = 0;
  while (p < xml.length) {
    const cs = nextCell(xml, p);
    if (cs === -1) break;
    const ce = outerCellEnd(xml, cs);
    if (ce === -1) break;
    if (normLabel(cellText(xml, cs, ce)) === ANCHOR) { anchorStart = cs; break; }
    p = ce + 7;
  }
  if (anchorStart === -1) return xml;

  const trStart = xml.lastIndexOf("<w:tr", anchorStart);
  if (trStart === -1) return xml;
  const trc = xml[trStart + 5];
  if (trc !== ">" && trc !== " " && trc !== "\n" && trc !== "\t") return xml;

  const cells: Array<{ start: number; end: number }> = [];
  p = trStart;
  while (p < anchorStart) {
    const cs = nextCell(xml, p);
    if (cs === -1 || cs >= anchorStart) break;
    const ce = outerCellEnd(xml, cs);
    if (ce === -1) break;
    cells.push({ start: cs, end: ce });
    p = ce + 7;
  }

  const targets: [number, string][] = [
    [cells.length - 3, religion],
    [cells.length - 2, height],
    [cells.length - 1, weight],
  ];

  let result = xml;
  for (const [idx, value] of [...targets].reverse()) {
    if (idx < 0 || idx >= cells.length || !value) continue;
    const { start: cs, end: ce } = cells[idx];
    let first = true;
    let newCell = result.slice(cs, ce + 7).replace(
      /<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g,
      (_, attrs) => {
        if (first) {
          first = false;
          return `<w:t${value.includes(" ") ? ' xml:space="preserve"' : (attrs ?? "")}>${xmlEsc(value)}</w:t>`;
        }
        return `<w:t${attrs ?? ""}></w:t>`;
      },
    );
    if (first) {
      const pEnd = newCell.indexOf("</w:p>");
      if (pEnd !== -1)
        newCell = newCell.slice(0, pEnd) + `<w:r><w:t${value.includes(" ") ? ' xml:space="preserve"' : ""}>${xmlEsc(value)}</w:t></w:r>` + newCell.slice(pEnd);
    }
    if (opts?.bold) newCell = boldifyCell(newCell);
    newCell = centerAlignCell(newCell);
    result = result.slice(0, cs) + newCell + result.slice(ce + 7);
  }
  return result;
}

function fillField(xml: string, label: string, value: string, opts?: { bold?: boolean }): string {
  const normTarget = normLabel(label);
  let pos = 0;
  while (pos < xml.length) {
    const cellStart = nextCell(xml, pos);
    if (cellStart === -1) break;
    const cellEnd = outerCellEnd(xml, cellStart);
    if (cellEnd === -1) break;

    if (normLabel(cellText(xml, cellStart, cellEnd)) === normTarget) {
      let nStart = nextCell(xml, cellEnd + 7);
      if (nStart === -1) { pos = cellEnd + 7; continue; }
      let nEnd = outerCellEnd(xml, nStart);
      if (nEnd === -1) { pos = cellEnd + 7; continue; }

      // If the next cell is an Arabic label cell, skip it and use the one after.
      // Handles templates with [English Label] | [Arabic Label] | [Value].
      if (/[؀-ۿ]/.test(cellText(xml, nStart, nEnd))) {
        const s2 = nextCell(xml, nEnd + 7);
        if (s2 !== -1) {
          const e2 = outerCellEnd(xml, s2);
          if (e2 !== -1) { nStart = s2; nEnd = e2; }
        }
      }

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
      if (opts?.bold) newCell = boldifyCell(newCell);
      newCell = centerAlignCell(newCell);
      return xml.slice(0, nStart) + newCell + xml.slice(nEnd + 7);
    }

    pos = cellEnd + 7;
  }
  return xml;
}

// Fills the cell IMMEDIATELY BEFORE the label cell with the given value.
// Used for RTL (Arabic) label cells where [value cell] comes before [label cell]
// in the XML cell order (opposite of standard LTR fillField).
function fillFieldBefore(xml: string, label: string, value: string, opts?: { bold?: boolean }): string {
  const normTarget = normLabel(label);
  let pos = 0;
  let prevStart = -1;
  let prevEnd = -1;
  while (pos < xml.length) {
    const cellStart = nextCell(xml, pos);
    if (cellStart === -1) break;
    const cellEnd = outerCellEnd(xml, cellStart);
    if (cellEnd === -1) break;

    if (normLabel(cellText(xml, cellStart, cellEnd)) === normTarget && prevStart !== -1) {
      const spaceAttr = value.includes(" ") ? ' xml:space="preserve"' : "";
      let first = true;
      let newCell = xml.slice(prevStart, prevEnd + 7).replace(
        /<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g,
        (_, attrs) => {
          if (first) {
            first = false;
            return `<w:t${value.includes(" ") ? ' xml:space="preserve"' : (attrs ?? "")}>${xmlEsc(value)}</w:t>`;
          }
          return `<w:t${attrs ?? ""}></w:t>`;
        },
      );
      if (first) {
        const pEnd = newCell.indexOf("</w:p>");
        if (pEnd !== -1) {
          newCell = newCell.slice(0, pEnd)
            + `<w:r><w:t${spaceAttr}>${xmlEsc(value)}</w:t></w:r>`
            + newCell.slice(pEnd);
        }
      }
      if (opts?.bold) newCell = boldifyCell(newCell);
      newCell = centerAlignCell(newCell);
      return xml.slice(0, prevStart) + newCell + xml.slice(prevEnd + 7);
    }

    prevStart = cellStart;
    prevEnd = cellEnd;
    pos = cellEnd + 7;
  }
  return xml;
}

// ── Cell dimension helpers ────────────────────────────────────────────────────

// Walk up the XML to find the enclosing <w:tbl> and return its declared width
// in EMU. Needed to resolve cells whose width is expressed as a percentage.
function resolveTableWidth(xml: string, from: number): number {
  const start = xml.lastIndexOf("<w:tbl", from);
  if (start === -1) return Math.round((9360 / 1440) * 914400);
  const prEnd = xml.indexOf("</w:tblPr>", start);
  const slice = xml.slice(start, prEnd > -1 ? prEnd + 10 : start + 3000);
  const attrs = /<w:tblW\b([^/]*)\/?>/.exec(slice)?.[1] ?? "";
  const w     = parseInt(/\bw:w="(\d+)"/.exec(attrs)?.[1] ?? "0");
  const t     = /\bw:type="([^"]+)"/.exec(attrs)?.[1] ?? "";
  return t === "dxa" && w > 0
    ? Math.round((w / 1440) * 914400)
    : Math.round((9360 / 1440) * 914400); // A4/Letter printable width fallback
}

// When a cell contains a nested table (e.g. photo placeholder cells that use a nested
// table to set visual height), sum that table's row heights to get the true display
// height. Returns 0 if no nested table or no explicit row heights are declared.
function resolveNestedTableHeight(cellSlice: string): number {
  if (!cellSlice.includes("<w:tbl")) return 0;
  let total = 0;
  const re = /<w:trHeight\b([^>]*)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cellSlice)) !== null) {
    total += parseInt(/\bw:val="(\d+)"/.exec(m[1])?.[1] ?? "0");
  }
  return total > 0 ? Math.round((total / 1440) * 914400) : 0;
}

// Resolve the cell's declared width in EMU, handling dxa and pct units.
function resolveCellWidth(cellSlice: string, tblWidthEmu: number): number {
  const attrs = /<w:tcW\b([^/]*)\/?>/.exec(cellSlice)?.[1] ?? "";
  const w     = parseInt(/\bw:w="(\d+)"/.exec(attrs)?.[1] ?? "0");
  const t     = /\bw:type="([^"]+)"/.exec(attrs)?.[1] ?? "";
  if (t === "dxa" && w > 0) return Math.round((w / 1440) * 914400);
  // pct values are in fiftieths of a percent (5000 = 100%)
  if (t === "pct" && w > 0) return Math.round(tblWidthEmu * (w / 5000));
  return Math.round(tblWidthEmu * 0.30); // fallback: ~30% of table width
}

// Return the total declared height in EMU of a (potentially merged) cell by
// summing <w:trHeight> across all rows it spans. Returns 0 for auto-height rows
// so the caller can fall back to proportional sizing.
function resolveCellHeight(xml: string, cellStart: number, cellEnd: number): number {
  const cellSlice = xml.slice(cellStart, cellEnd + 7);
  const trStart   = xml.lastIndexOf("<w:tr", cellStart);
  if (trStart === -1) return 0;

  const firstTrPr  = xml.slice(trStart, cellStart);
  const firstAttrs = /<w:trHeight\b([^/]*)\/?>/.exec(firstTrPr)?.[1] ?? "";
  const firstH     = parseInt(/\bw:val="(\d+)"/.exec(firstAttrs)?.[1] ?? "0");

  // Non-merged cell — return just this row's height
  if (!/<w:vMerge\b/.test(cellSlice)) {
    return firstH > 0 ? Math.round((firstH / 1440) * 914400) : 0;
  }

  // Merged cell: determine column index then accumulate continuation rows
  let colIdx = 0, p = xml.indexOf("<w:tc", trStart);
  while (p !== -1 && p < cellStart) {
    const ch = xml[p + 5];
    if (ch === ">" || ch === " " || ch === "\n" || ch === "\t") colIdx++;
    p = xml.indexOf("<w:tc", p + 1);
  }

  let total    = firstH;
  let curTrEnd = xml.indexOf("</w:tr>", trStart);

  while (curTrEnd !== -1) {
    const nextTrStart = xml.indexOf("<w:tr", curTrEnd + 7);
    if (nextTrStart === -1) break;
    const nextTrEnd   = xml.indexOf("</w:tr>", nextTrStart);
    const nextTrSlice = xml.slice(nextTrStart, nextTrEnd > -1 ? nextTrEnd + 7 : nextTrStart + 20_000);

    // Find the cell at our column index and check for merge continuation
    let ci = 0, cp = 0, isContinuation = false;
    while (true) {
      const idx = nextTrSlice.indexOf("<w:tc", cp);
      if (idx === -1) break;
      const ch2 = nextTrSlice[idx + 5];
      if (ch2 === ">" || ch2 === " " || ch2 === "\n" || ch2 === "\t") {
        if (ci === colIdx) {
          const ce2 = nextTrSlice.indexOf("</w:tc>", idx);
          const cs2 = nextTrSlice.slice(idx, ce2 > -1 ? ce2 : idx + 3000);
          // Continuation = has <w:vMerge> but NOT w:val="restart"
          isContinuation = /<w:vMerge\b/.test(cs2) && !/<w:vMerge\b[^>]*w:val="restart"/.test(cs2);
          break;
        }
        ci++;
      }
      cp = idx + 1;
    }
    if (!isContinuation) break;

    const hAttrs = /<w:trHeight\b([^/]*)\/?>/.exec(nextTrSlice)?.[1] ?? "";
    total += parseInt(/\bw:val="(\d+)"/.exec(hAttrs)?.[1] ?? "0");
    curTrEnd = nextTrEnd;
  }

  return total > 0 ? Math.round((total / 1440) * 914400) : 0;
}

// Replaces the cell whose text IS `label` with the inline image.
// Reads cell width and row height from the OOXML so the image fills the cell.
function replaceImageCell(
  xml: string,
  label: string,
  rId: string,
  naturalW: number,
  naturalH: number,
  picId: number,
): string {
  const normTarget = normLabel(label);
  let pos = 0;
  while (pos < xml.length) {
    const cellStart = nextCell(xml, pos);
    if (cellStart === -1) break;
    const cellEnd = outerCellEnd(xml, cellStart);
    if (cellEnd === -1) break;

    if (normLabel(cellText(xml, cellStart, cellEnd)) === normTarget) {
      const cellSlice = xml.slice(cellStart, cellEnd + 7);

      const tblW  = resolveTableWidth(xml, cellStart);
      let cxEmu   = resolveCellWidth(cellSlice, tblW);
      const cellH   = resolveCellHeight(xml, cellStart, cellEnd);
      const nestedH = resolveNestedTableHeight(cellSlice);

      // Priority: nested-table height (photo cells that embed a nested table to set
      // visual height) → outer row accumulated height → proportional to image.
      // The image is stretched to fill cx × cy via <a:stretch><a:fillRect/></a:stretch>.
      const cyEmu = nestedH > 0
        ? nestedH
        : (cellH > 0
          ? cellH
          : (naturalW > 0 ? Math.round(cxEmu * (naturalH / naturalW)) : cxEmu));

      const tcPrMatch = cellSlice.match(/<w:tcPr[\s\S]*?<\/w:tcPr>/);
      const tcPr = tcPrWithZeroMargins(tcPrMatch ? tcPrMatch[0] : "");
      const newCell = `<w:tc>${tcPr}${inlineDrawingXml(rId, label, picId, cxEmu, cyEmu)}</w:tc>`;
      return xml.slice(0, cellStart) + newCell + xml.slice(cellEnd + 7);
    }

    pos = cellEnd + 7;
  }
  return xml;
}

// Like replaceImageCell but matches any cell whose normalized text CONTAINS `substring`.
// Used in the fallback path where exact label wording is unknown.
// Because a replaced cell loses its text, calling this multiple times on the same xml
// is safe — already-replaced cells won't re-match.
function replaceImageCellContaining(
  xml: string,
  substring: string,
  rId: string,
  naturalW: number,
  naturalH: number,
  picId: number,
): string {
  const normSub = normLabel(substring);
  let pos = 0;
  while (pos < xml.length) {
    const cellStart = nextCell(xml, pos);
    if (cellStart === -1) break;
    const cellEnd = outerCellEnd(xml, cellStart);
    if (cellEnd === -1) break;
    if (normLabel(cellText(xml, cellStart, cellEnd)).includes(normSub)) {
      const cellSlice = xml.slice(cellStart, cellEnd + 7);
      const tblW  = resolveTableWidth(xml, cellStart);
      let cxEmu   = resolveCellWidth(cellSlice, tblW);
      const cellH   = resolveCellHeight(xml, cellStart, cellEnd);
      const nestedH = resolveNestedTableHeight(cellSlice);
      const cyEmu   = nestedH > 0
        ? nestedH
        : (cellH > 0
          ? cellH
          : (naturalW > 0 ? Math.round(cxEmu * (naturalH / naturalW)) : cxEmu));
      const tcPrMatch = cellSlice.match(/<w:tcPr[\s\S]*?<\/w:tcPr>/);
      const tcPr = tcPrWithZeroMargins(tcPrMatch ? tcPrMatch[0] : "");
      const newCell = `<w:tc>${tcPr}${inlineDrawingXml(rId, substring, picId, cxEmu, cyEmu)}</w:tc>`;
      return xml.slice(0, cellStart) + newCell + xml.slice(cellEnd + 7);
    }
    pos = cellEnd + 7;
  }
  return xml;
}

export async function fetchImgBytes(src: string): Promise<{ bytes: Uint8Array; ext: string } | null> {
  try {
    const r = await fetch(src, { mode: "cors" });
    if (!r.ok) return null;
    const mime = r.headers.get("content-type") ?? "";
    const ext  = mime.includes("png") ? "png" : "jpg";
    return { bytes: new Uint8Array(await r.arrayBuffer()), ext };
  } catch { return null; }
}

export async function bytesToDims(bytes: Uint8Array): Promise<{ w: number; h: number }> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url; });
    return { w: img.naturalWidth || 300, h: img.naturalHeight || 400 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Replace existing <w:tcMar> (or add one) with zero values so the image sits
// flush against all four cell edges with no padding gap.
function tcPrWithZeroMargins(tcPr: string): string {
  const zeroMar = `<w:tcMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tcMar>`;
  if (!tcPr) return `<w:tcPr>${zeroMar}</w:tcPr>`;
  if (/<w:tcMar\b/.test(tcPr)) return tcPr.replace(/<w:tcMar\b[\s\S]*?<\/w:tcMar>/, zeroMar);
  return tcPr.replace("</w:tcPr>", `${zeroMar}</w:tcPr>`);
}

function inlineDrawingXml(rId: string, name: string, picId: number, cxEmu: number, cyEmu: number): string {
  return [
    `<w:p><w:pPr>`,
    `<w:jc w:val="left"/>`,
    `<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>`,
    `<w:ind w:left="0" w:right="0"/>`,
    `</w:pPr><w:r><w:drawing>`,
    `<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"`,
    ` distT="0" distB="0" distL="0" distR="0">`,
    `<wp:extent cx="${cxEmu}" cy="${cyEmu}"/>`,
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>`,
    `<wp:docPr id="${picId}" name="${xmlEscAttr(name)}"/>`,
    `<wp:cNvGraphicFramePr>`,
    `<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>`,
    `</wp:cNvGraphicFramePr>`,
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">`,
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`,
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">`,
    `<pic:nvPicPr><pic:cNvPr id="${picId}" name="${xmlEscAttr(name)}"/><pic:cNvPicPr/></pic:nvPicPr>`,
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

// Replaces <wp:anchor> blocks that contain a wpg:wgp group wrapping rId with a
// simple <wp:inline> drawing. docx-preview cannot render wpg:wgp anchor groups,
// so photos embedded inside wps:txbx shapes (e.g. Monaco template) are invisible —
// unwrapping them to an inline drawing makes them visible without changing image data.
function simplifyWpgAnchorForRId(xml: string, rId: string, cx: number, cy: number): string {
  const embedTag = `r:embed="${rId}"`;
  let pos = 0;
  while (pos < xml.length) {
    const anchorStart = xml.indexOf("<wp:anchor", pos);
    if (anchorStart === -1) break;

    let depth = 1, scan = anchorStart + 10;
    while (depth > 0 && scan < xml.length) {
      const nxOpen  = xml.indexOf("<wp:anchor",   scan);
      const nxClose = xml.indexOf("</wp:anchor>", scan);
      if (nxClose === -1) { scan = xml.length; break; }
      if (nxOpen !== -1 && nxOpen < nxClose) { depth++; scan = nxOpen + 10; }
      else                                    { depth--; scan = nxClose + 12; }
    }
    if (depth !== 0) { pos = anchorStart + 1; continue; }
    const anchorEnd = scan;

    const block = xml.slice(anchorStart, anchorEnd);
    if (block.includes("wpg:wgp") && block.includes(embedTag)) {
      const attrStr = /<wp:docPr\b([^>]*)\/?>/.exec(block)?.[1] ?? "";
      const picId   = parseInt(/\bid="(\d+)"/.exec(attrStr)?.[1] ?? "98");
      const name    = /\bname="([^"]*)"/.exec(attrStr)?.[1] ?? "Photo";
      const wpInline = [
        `<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"`,
        ` distT="0" distB="0" distL="0" distR="0">`,
        `<wp:extent cx="${cx}" cy="${cy}"/>`,
        `<wp:effectExtent l="0" t="0" r="0" b="0"/>`,
        `<wp:docPr id="${picId}" name="${xmlEscAttr(name)}"/>`,
        `<wp:cNvGraphicFramePr>`,
        `<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>`,
        `</wp:cNvGraphicFramePr>`,
        `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">`,
        `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`,
        `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">`,
        `<pic:nvPicPr><pic:cNvPr id="${picId}" name="${xmlEscAttr(name)}"/><pic:cNvPicPr/></pic:nvPicPr>`,
        `<pic:blipFill>`,
        `<a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>`,
        `<a:stretch><a:fillRect/></a:stretch>`,
        `</pic:blipFill>`,
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`,
        `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`,
        `</pic:pic></a:graphicData></a:graphic></wp:inline>`,
      ].join("");
      xml = xml.slice(0, anchorStart) + wpInline + xml.slice(anchorEnd);
      pos = anchorStart + wpInline.length;
    } else {
      pos = anchorEnd;
    }
  }
  return xml;
}

// Rescales all cx/cy attribute pairs inside a <wp:inline> block that embeds rId.
// Used to cap oversized full-body photos (e.g. 11"×17") to the A4 printable area
// so they render correctly in docx-preview's 794px container instead of overflowing.
function fixInlineDrawingSize(xml: string, rId: string, newCx: number, newCy: number): string {
  const embedTag = `r:embed="${rId}"`;
  let pos = 0;
  while (pos < xml.length) {
    const inlineStart = xml.indexOf("<wp:inline", pos);
    if (inlineStart === -1) break;
    const inlineEnd = xml.indexOf("</wp:inline>", inlineStart);
    if (inlineEnd === -1) break;
    const inlineEndFull = inlineEnd + 12;
    const block = xml.slice(inlineStart, inlineEndFull);
    if (block.includes(embedTag)) {
      const newBlock = block
        .replace(/\bcx="(\d+)"/g, `cx="${newCx}"`)
        .replace(/\bcy="(\d+)"/g, `cy="${newCy}"`);
      xml = xml.slice(0, inlineStart) + newBlock + xml.slice(inlineEndFull);
      pos = inlineStart + newBlock.length;
    } else {
      pos = inlineEndFull;
    }
  }
  return xml;
}

// Resizes an inline drawing (r:embed=rId) to fill its enclosing <w:tc> cell.
// Walks back from the r:embed occurrence to find the nearest containing cell,
// measures cx from cell width and cy from row/nested-table height, then
// calls fixInlineDrawingSize with those dimensions. Returns the new xml and
// the resolved (cx, cy) — both are 0 when no cell/inline drawing was found.
function fitDrawingToCell(xml: string, rId: string): { xml: string; cx: number; cy: number } {
  const embedTag = `r:embed="${rId}"`;
  const embedPos = xml.indexOf(embedTag);
  if (embedPos === -1) return { xml, cx: 0, cy: 0 };

  let searchBack = embedPos;
  while (searchBack > 0) {
    const tcPos = xml.lastIndexOf("<w:tc", searchBack - 1);
    if (tcPos === -1) break;
    const ch = xml[tcPos + 5];
    if (ch === ">" || ch === " " || ch === "\n" || ch === "\t") {
      const cellEnd = outerCellEnd(xml, tcPos);
      if (cellEnd !== -1 && cellEnd + 7 > embedPos) {
        const cellSlice = xml.slice(tcPos, cellEnd + 7);
        const tblW  = resolveTableWidth(xml, tcPos);
        const cx    = resolveCellWidth(cellSlice, tblW);
        const cellH = resolveCellHeight(xml, tcPos, cellEnd);
        const nestedH = resolveNestedTableHeight(cellSlice);
        const cy    = nestedH > 0 ? nestedH : cellH;
        if (cx > 0 && cy > 0) {
          return { xml: fixInlineDrawingSize(xml, rId, cx, cy), cx, cy };
        }
      }
      break;
    }
    searchBack = tcPos;
  }
  return { xml, cx: 0, cy: 0 };
}

// ── Live image-slot detection ─────────────────────────────────────────────────
// Scans ANY DOCX document.xml at export time — no pre-stored metadata needed.
// Uses depth-counted traversal so nested structures (WPG anchors → wps:txbx →
// inner <w:drawing>) are walked correctly and not mis-matched by naive regexes.
// Returns every portrait drawing classified by proportion:
//   portrait + narrow cx  → "photo"     (face / passport-size)
//   portrait + wide cx    → "fullphoto" (full-body)
//   landscape             → "passport"  (company logo, header strip — skipped at inject time)
interface LiveSlot {
  rId: string; target: string; cx: number; cy: number;
  purpose: "photo" | "fullphoto" | "passport" | "unknown";
  inWpgAnchor: boolean; // true → WPG group anchor; needs unwrapping before docx-preview renders it
}

function liveExtractImageSlots(docXml: string, relsXml: string): LiveSlot[] {
  const relMap = new Map<string, string>();
  const relRe = /<Relationship\b[^>]*\/>/g;
  let rm: RegExpExecArray | null;
  while ((rm = relRe.exec(relsXml)) !== null) {
    const id     = /\bId="([^"]+)"/.exec(rm[0])?.[1];
    const type   = /\bType="([^"]+)"/.exec(rm[0])?.[1] ?? "";
    const target = /\bTarget="([^"]+)"/.exec(rm[0])?.[1];
    if (id && target && type.endsWith("/image")) relMap.set(id, target);
  }
  if (relMap.size === 0) return [];

  const slots: LiveSlot[] = [];
  const seen  = new Set<string>();
  let pos = 0;

  while (pos < docXml.length) {
    const drawStart = docXml.indexOf("<w:drawing", pos);
    if (drawStart === -1) break;
    // Guard: must be <w:drawing> or <w:drawing<space>, not <w:drawingXyz>
    const dc = docXml[drawStart + 10];
    if (dc !== ">" && dc !== " " && dc !== "\n" && dc !== "\t") { pos = drawStart + 1; continue; }

    // Depth-count to find the matching </w:drawing>
    let depth = 1, scan = drawStart + 10;
    while (depth > 0 && scan < docXml.length) {
      const nxOpen  = docXml.indexOf("<w:drawing",   scan);
      const nxClose = docXml.indexOf("</w:drawing>", scan);
      if (nxClose === -1) { scan = docXml.length; break; }
      if (nxOpen !== -1 && nxOpen < nxClose) {
        const nc = docXml[nxOpen + 10];
        if (nc === ">" || nc === " " || nc === "\n" || nc === "\t") depth++;
        scan = nxOpen + 10;
      } else {
        depth--;
        scan = nxClose + 12;
      }
    }
    if (depth !== 0) { pos = drawStart + 1; continue; }
    const drawEnd = scan;

    const block = docXml.slice(drawStart, drawEnd);
    const rId   = /\br:embed="([^"]+)"/.exec(block)?.[1];
    if (!rId || seen.has(rId)) { pos = drawEnd; continue; }
    const target = relMap.get(rId);
    if (!target)               { pos = drawEnd; continue; }
    seen.add(rId);

    const inWpgAnchor = block.includes("<wp:anchor") && block.includes("wpg:wgp");

    // For WPG-wrapped drawings use the outer anchor extent (the designer's intended footprint).
    // For plain anchors/inlines, the first <wp:extent> is the display size.
    let cx = 0, cy = 0;
    const extSrc = inWpgAnchor ? block.slice(block.indexOf("<wp:anchor")) : block;
    const extAttrs = /<wp:extent\b([^/]*)\/?>/.exec(extSrc)?.[1] ?? "";
    cx = parseInt(/\bcx="(\d+)"/.exec(extAttrs)?.[1] ?? "0");
    cy = parseInt(/\bcy="(\d+)"/.exec(extAttrs)?.[1] ?? "0");

    // Skip placeholders too small to be photos (decorative icons, bullets, tiny logos)
    if (!cx || !cy || cx < 400_000 || cy < 400_000) { pos = drawEnd; continue; }

    // Classify by portrait vs landscape and physical width
    let purpose: LiveSlot["purpose"];
    if (cy > cx)          purpose = cx > 4_500_000 ? "fullphoto" : "photo";
    else if (cx > cy * 1.2) purpose = "passport";
    else                   purpose = "unknown";

    slots.push({ rId, target, cx, cy, purpose, inWpgAnchor });
    pos = drawEnd;
  }
  return slots;
}

export async function buildFilledDocx(template: CvTemplate, c: Candidate, embedPassport = true): Promise<Uint8Array> {
  const res = await fetch(template.file_url, { mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 100) throw new Error("Template file is empty");
  const zip   = new PizZip(buf);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("word/document.xml missing");
  let xml = new TextDecoder("utf-8").decode(entry.asUint8Array());

  // Use Claude's label mapping if the template has metadata; otherwise fall back to standard labels
  const meta = (template.metadata as TemplateMetadata | null | undefined);
  const fieldPairs: [string, string][] =
    meta?.fieldMap && Object.keys(meta.fieldMap).length > 0
      ? Object.entries(meta.fieldMap).map(([lbl, std]) => [lbl, getCandidateFieldValue(c, std)])
      : CV_FIELD_MAP(c);

  const fillOpts = template.name?.toLowerCase().includes("tadbeer") ? { bold: true } : undefined;
  const isJawa = template.name?.toLowerCase().includes("jawa");

  // Jawa template: Religion, Height, Weight labels are in one row but their values
  // are in the next row — fill them positionally before the standard label pass runs
  // (which would otherwise corrupt the label cells by treating them as value cells).
  if (isJawa) {
    const h = c.height != null ? `${c.height} cm` : "";
    const w = c.weight != null ? `${c.weight} kg` : "";
    xml = fillJawaSpecialRow(xml, c.religion ?? "", h, w, fillOpts);
  }

  // Standard label-based fill; skip Jawa's positionally-filled fields to avoid
  // the label cells (Religion / Height / Weight) being treated as value targets.
  const jawaSkip = isJawa ? new Set(["RELIGION", "HEIGHT", "WEIGHT"]) : null;
  for (const [label, value] of fieldPairs) {
    if (!value) continue;
    if (jawaSkip?.has(normLabel(label))) continue;
    xml = fillField(xml, label, value, fillOpts);
  }

  // Secondary pass: fill Arabic RTL value cells (cell before the Arabic label)
  for (const [label, value] of CV_ARABIC_FIELD_MAP(c)) {
    if (!value) continue;
    xml = fillFieldBefore(xml, label, value, fillOpts);
  }

  const relsPath  = "word/_rels/document.xml.rels";
  const relsEntry = zip.file(relsPath);
  let relsXml = relsEntry
    ? new TextDecoder().decode(relsEntry.asUint8Array())
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

  const ctPath  = "[Content_Types].xml";
  const ctEntry = zip.file(ctPath);
  let ctXml = ctEntry ? new TextDecoder().decode(ctEntry.asUint8Array()) : "";

  // ── Universal photo injection ─────────────────────────────────────────────────
  // Live-detect every image drawing in the template (handles WPG groups, nested
  // text boxes, plain anchors, and inline drawings — any structure any template uses).
  // Inject the candidate's photo/fullphoto, then auto-normalize the drawing so
  // docx-preview renders it correctly regardless of the original template structure.
  const liveSlots    = liveExtractImageSlots(xml, relsXml);
  const livePhoto     = liveSlots.find(s => s.purpose === "photo");
  const liveFullPhoto = liveSlots.find(s => s.purpose === "fullphoto");

  const injectPhotoSlot = async (slot: LiveSlot, src: string) => {
    const img = await fetchImgBytes(src);
    if (!img) return;

    // 1. Swap the image file in the zip
    const base    = slot.target.replace(/[^/]*$/, "");
    const newFile = `${base}cv_${slot.purpose}_${slot.rId}.${img.ext}`;
    if (zip.file(`word/${slot.target}`)) zip.remove(`word/${slot.target}`);
    zip.file(`word/${newFile}`, img.bytes);

    // 2. Point the relationship to the new file
    const esc = slot.rId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    relsXml = relsXml.replace(
      new RegExp(`<Relationship\\b[^>]*\\bId="${esc}"[^>]*/>`),
      (el) => el.replace(/\bTarget="[^"]*"/, `Target="${newFile}"`),
    );

    // 3. Register new extension in [Content_Types].xml if needed
    if (ctXml && !ctXml.includes(`Extension="${img.ext}"`)) {
      const mime = img.ext === "png" ? "image/png" : "image/jpeg";
      ctXml = ctXml.replace("</Types>", `<Default Extension="${img.ext}" ContentType="${mime}"/></Types>`);
    }

    // 4. Unwrap WPG anchor groups → plain <wp:inline> so docx-preview can render them.
    // Only applies to PDF path — for DOCX downloads Word handles WPG natively and
    // unwrapping strips structure Word validates, corrupting the file.
    if (!embedPassport && slot.inWpgAnchor)
      xml = simplifyWpgAnchorForRId(xml, slot.rId, slot.cx, slot.cy);

    // 5. Fit the inline drawing to its container cell dimensions.
    //    Applies to both DOCX and PDF paths (only affects <wp:inline> drawings;
    //    WPG anchors kept intact for Word are untouched since fixInlineDrawingSize
    //    only rewrites <wp:inline> blocks).
    const fitted = fitDrawingToCell(xml, slot.rId);
    xml = fitted.xml;

    // 6. Cap drawings that still overflow the A4 printable area (~6.5"×9.5" in EMU).
    //    Uses cell dims when fitDrawingToCell succeeded; falls back to slot dims.
    //    PDF path only — Word scales DOCX drawings natively.
    if (!embedPassport) {
      const MAX_CX = 5_942_700, MAX_CY = 8_687_100;
      const baseCx = fitted.cx > 0 ? fitted.cx : slot.cx;
      const baseCy = fitted.cy > 0 ? fitted.cy : slot.cy;
      if (baseCx > MAX_CX || baseCy > MAX_CY) {
        const scale = Math.min(MAX_CX / baseCx, MAX_CY / baseCy);
        xml = fixInlineDrawingSize(xml, slot.rId, Math.round(baseCx * scale), Math.round(baseCy * scale));
      }
    }
  };

  if (liveFullPhoto && (c.full_photo_url || c.photo_url))
    await injectPhotoSlot(liveFullPhoto, (c.full_photo_url ?? c.photo_url)!);
  if (livePhoto && (c.photo_url || c.full_photo_url))
    await injectPhotoSlot(livePhoto, (c.photo_url ?? c.full_photo_url)!);

  // ── Cell-based image fill ───────────────────────────────────────────────────
  const IMG_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
  const metaImageCells = meta?.imageCells ?? [];

  if (metaImageCells.length > 0) {
    // Metadata path: Claude identified the exact placeholder cells at upload time.
    // Each cell.label IS the cell to replace (not adjacent), so use replaceImageCell.
    let picId = 50;
    for (const cell of metaImageCells) {
      if (cell.purpose === "passport") continue; // always a dedicated page, never in-cell
      const src =
        cell.purpose === "fullphoto" ? (c.full_photo_url ?? c.photo_url) :
        /* photo */                    (c.photo_url ?? c.full_photo_url);
      if (!src) continue;
      const img = await fetchImgBytes(src);
      if (!img) continue;
      const rId   = `rIdCell_${cell.purpose}_${picId}`;
      const fname = `media/cv_cell_${cell.purpose}_${picId}.${img.ext}`;
      zip.file(`word/${fname}`, img.bytes);
      if (!relsXml.includes(`Id="${rId}"`))
        relsXml = relsXml.replace("</Relationships>",
          `<Relationship Id="${rId}" Type="${IMG_REL}" Target="${fname}"/></Relationships>`);
      if (ctXml && !ctXml.includes(`Extension="${img.ext}"`)) {
        const mime = img.ext === "png" ? "image/png" : "image/jpeg";
        ctXml = ctXml.replace("</Types>", `<Default Extension="${img.ext}" ContentType="${mime}"/></Types>`);
      }
      const dims = await bytesToDims(img.bytes);
      // Exact match first; fall back to contains for Arabic/English mixed cells
      const before = xml;
      xml = replaceImageCell(xml, cell.label, rId, dims.w, dims.h, picId);
      if (xml === before)
        xml = replaceImageCellContaining(xml, cell.label, rId, dims.w, dims.h, picId);
      picId++;
    }
  }

  // Keyword scan — always runs after Claude path so cells Claude missed (or templates with no
  // imageCells metadata) are still filled. Already-replaced cells have no text left, so these
  // replaceImageCellContaining calls are safely idempotent. picIds 70-82 avoid the 50-N range
  // used by the Claude path above.
  {
    // Full-body photo — most-specific substrings first so "PHOTO" doesn't steal "FULL SIZE PHOTO"
    const fullPhotoSrc = c.full_photo_url ?? c.photo_url;
    if (fullPhotoSrc) {
      const img = await fetchImgBytes(fullPhotoSrc);
      if (img) {
        const rId   = "rIdCvFullPhotoCell";
        const fname = `media/cv_fullphoto_cell.${img.ext}`;
        zip.file(`word/${fname}`, img.bytes);
        if (!relsXml.includes(`Id="${rId}"`))
          relsXml = relsXml.replace("</Relationships>", `<Relationship Id="${rId}" Type="${IMG_REL}" Target="${fname}"/></Relationships>`);
        if (ctXml && !ctXml.includes(`Extension="${img.ext}"`)) {
          const mime = img.ext === "png" ? "image/png" : "image/jpeg";
          ctXml = ctXml.replace("</Types>", `<Default Extension="${img.ext}" ContentType="${mime}"/></Types>`);
        }
        const d = await bytesToDims(img.bytes);
        xml = replaceImageCellContaining(xml, "FULL SIZE PHOTO",    rId, d.w, d.h, 71);
        xml = replaceImageCellContaining(xml, "FULL SIZE PICTURE",  rId, d.w, d.h, 72);
        xml = replaceImageCellContaining(xml, "FULL BODY PHOTO",    rId, d.w, d.h, 73);
        xml = replaceImageCellContaining(xml, "FULL BODY PICTURE",  rId, d.w, d.h, 74);
        xml = replaceImageCellContaining(xml, "FULL LENGTH PHOTO",  rId, d.w, d.h, 75);
        xml = replaceImageCellContaining(xml, "FULL LENGTH",        rId, d.w, d.h, 76);
        xml = replaceImageCellContaining(xml, "WHOLE BODY",         rId, d.w, d.h, 77);
        xml = replaceImageCellContaining(xml, "BODY PHOTO",         rId, d.w, d.h, 78);
        xml = replaceImageCellContaining(xml, "FULL PHOTO",         rId, d.w, d.h, 79);
      }
    }
    // Passport-size photo — runs after full variants so generic "PHOTO" doesn't steal those cells
    const photoSrc = c.photo_url ?? c.full_photo_url;
    if (photoSrc) {
      const img = await fetchImgBytes(photoSrc);
      if (img) {
        const rId   = "rIdCvPhotoCell";
        const fname = `media/cv_photo_cell.${img.ext}`;
        zip.file(`word/${fname}`, img.bytes);
        if (!relsXml.includes(`Id="${rId}"`))
          relsXml = relsXml.replace("</Relationships>", `<Relationship Id="${rId}" Type="${IMG_REL}" Target="${fname}"/></Relationships>`);
        if (ctXml && !ctXml.includes(`Extension="${img.ext}"`)) {
          const mime = img.ext === "png" ? "image/png" : "image/jpeg";
          ctXml = ctXml.replace("</Types>", `<Default Extension="${img.ext}" ContentType="${mime}"/></Types>`);
        }
        const d = await bytesToDims(img.bytes);
        xml = replaceImageCellContaining(xml, "4X4",         rId, d.w, d.h, 80);
        xml = replaceImageCellContaining(xml, "PHOTOGRAPH",  rId, d.w, d.h, 81);
        xml = replaceImageCellContaining(xml, "PICTURE",     rId, d.w, d.h, 82);
        xml = replaceImageCellContaining(xml, "PHOTO",       rId, d.w, d.h, 70);
      }
    }
    // Passport scan is never placed in a cell — always appended as a dedicated page below.
  }

  // ── Passport page 2 in DOCX (for DOCX download / manual conversion) ──────────
  // Only embedded when embedPassport = true (DOCX export). PDF export uses addPassportScanPage instead.
  if (embedPassport && c.passport_scan_url) {
    const img = await fetchImgBytes(c.passport_scan_url);
    if (img) {
      const rId   = "rIdCvPassportP2";
      const fname = `media/cv_passport_p2.${img.ext}`;
      zip.file(`word/${fname}`, img.bytes);
      if (!relsXml.includes(`Id="${rId}"`))
        relsXml = relsXml.replace("</Relationships>",
          `<Relationship Id="${rId}" Type="${IMG_REL}" Target="${fname}"/></Relationships>`);
      if (ctXml && !ctXml.includes(`Extension="${img.ext}"`)) {
        const mime = img.ext === "png" ? "image/png" : "image/jpeg";
        ctXml = ctXml.replace("</Types>", `<Default Extension="${img.ext}" ContentType="${mime}"/></Types>`);
      }
      const dims  = await bytesToDims(img.bytes);
      // 60% of A4 printable width/height in EMU
      const maxW  = Math.round(9360 / 1440 * 914400 * 0.60);
      const maxH  = Math.round(12240 / 1440 * 914400 * 0.60);
      const scale = Math.min(maxW / dims.w, maxH / dims.h);
      const cxEmu = Math.round(dims.w * scale);
      const cyEmu = Math.round(dims.h * scale);
      // Single paragraph with <w:pageBreakBefore/> — forces this paragraph to start
      // on a new page without emitting a separate blank page-break paragraph.
      const passportContent = [
        `<w:p><w:pPr>`,
        `<w:pageBreakBefore/>`,
        `<w:jc w:val="center"/>`,
        `<w:spacing w:before="0" w:after="0"/>`,
        `</w:pPr><w:r><w:drawing>`,
        `<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">`,
        `<wp:extent cx="${cxEmu}" cy="${cyEmu}"/>`,
        `<wp:effectExtent l="0" t="0" r="0" b="0"/>`,
        `<wp:docPr id="99" name="PASSPORT SCAN"/>`,
        `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>`,
        `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">`,
        `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`,
        `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">`,
        `<pic:nvPicPr><pic:cNvPr id="99" name="PASSPORT SCAN"/><pic:cNvPicPr/></pic:nvPicPr>`,
        `<pic:blipFill><a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>`,
        `<a:stretch><a:fillRect/></a:stretch></pic:blipFill>`,
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cxEmu}" cy="${cyEmu}"/></a:xfrm>`,
        `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`,
        `</pic:pic></a:graphicData></a:graphic></wp:inline>`,
        `</w:drawing></w:r></w:p>`,
      ].join("");
      // Find insertion point: just before the body-level <w:sectPr>.
      const bodyPos        = xml.lastIndexOf("</w:body>");
      const sectPrClosePos = xml.lastIndexOf("</w:sectPr>");
      const sectPrOpenPos  = sectPrClosePos !== -1 && sectPrClosePos < bodyPos
        ? xml.lastIndexOf("<w:sectPr", sectPrClosePos)
        : -1;
      const insertAt = sectPrOpenPos !== -1 ? sectPrOpenPos : bodyPos;

      let beforeInsert = xml.slice(0, insertAt);

      // Returns true when the slice has balanced <w:tc> open/close counts,
      // meaning we are at body level and not mid-way through a table cell.
      const atBodyLevel = (slice: string): boolean => {
        const opens  = (slice.match(/<w:tc[\s>]/g) ?? []).length;
        const closes = (slice.match(/<\/w:tc>/g) ?? []).length;
        return opens === closes;
      };

      // Remove the intermediate section-break paragraph and everything after it.
      // 2-page templates embed a <w:sectPr> inside a paragraph's <w:pPr> to create
      // a page boundary — this is what produces the blank page-2 slot. Cutting at
      // that paragraph removes the blank page and all trailing placeholder content.
      // Guard: only truncate if the cut point is at body level, not inside a table cell.
      const innerSectPrPos = beforeInsert.indexOf("<w:sectPr");
      if (innerSectPrPos !== -1) {
        const paraStart = beforeInsert.lastIndexOf("<w:p", innerSectPrPos);
        if (paraStart !== -1) {
          const candidate = beforeInsert.slice(0, paraStart);
          if (atBodyLevel(candidate)) beforeInsert = candidate;
        }
      }

      // Strip any remaining trailing empty paragraphs (no <w:r> runs).
      // Only strip paragraphs that are at body level — never strip inside a table cell,
      // as that would leave unclosed <w:tc> tags before </w:body> and corrupt the file.
      let stripping = true;
      while (stripping) {
        stripping = false;
        let lastParaStart = -1;
        for (const tag of ["<w:p>", "<w:p/>", "<w:p "]) {
          const idx = beforeInsert.lastIndexOf(tag);
          if (idx > lastParaStart) lastParaStart = idx;
        }
        if (lastParaStart !== -1 && !/<w:r[\s>]/.test(beforeInsert.slice(lastParaStart))) {
          const candidate = beforeInsert.slice(0, lastParaStart);
          if (atBodyLevel(candidate)) {
            beforeInsert = candidate;
            stripping = true;
          }
        }
      }

      xml = beforeInsert + passportContent + xml.slice(insertAt);
    }
  }

  // Final authoritative write of rels + content types (overwrites earlier in-branch writes)
  zip.file(relsPath, new TextEncoder().encode(relsXml));
  if (ctXml) zip.file(ctPath, new TextEncoder().encode(ctXml));

  zip.file("word/document.xml", new TextEncoder().encode(xml));
  const result = zip.generate({ type: "uint8array" });
  validateDocxBytes(result);
  return result;
}

// ── Post-generation validation ────────────────────────────────────────────────
// Parses the generated ZIP as a DOCX, confirms document.xml is well-formed XML,
// and checks that every r:embed rId in document.xml has a matching relationship
// in document.xml.rels. Throws with a descriptive message on any failure so the
// caller can surface the error instead of delivering a corrupt file silently.
function validateDocxBytes(bytes: Uint8Array): void {
  let zip: PizZip;
  try {
    zip = new PizZip(bytes);
  } catch (e: any) {
    throw new Error(`DOCX validation: generated ZIP is unreadable — ${e?.message ?? e}`);
  }

  const docEntry = zip.file("word/document.xml");
  if (!docEntry) throw new Error("DOCX validation: word/document.xml is missing from the generated archive");
  if (!zip.file("[Content_Types].xml")) throw new Error("DOCX validation: [Content_Types].xml is missing from the generated archive");

  const docXml = new TextDecoder("utf-8").decode(docEntry.asUint8Array());

  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(docXml, "application/xml");
    const err = doc.querySelector("parsererror");
    if (err) {
      const detail = err.textContent?.slice(0, 300) ?? "(no detail)";
      console.error("[DOCX validation] document.xml parse error:", detail);
      throw new Error(`DOCX validation: document.xml is malformed XML — ${detail}`);
    }
  }

  const relsEntry = zip.file("word/_rels/document.xml.rels");
  if (relsEntry) {
    const relsXml = new TextDecoder("utf-8").decode(relsEntry.asUint8Array());
    const embedRe = /\br:embed="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = embedRe.exec(docXml)) !== null) {
      const rId = m[1];
      if (!relsXml.includes(`Id="${rId}"`)) {
        console.error(`[DOCX validation] r:embed="${rId}" has no matching relationship in document.xml.rels`);
        throw new Error(`DOCX validation: r:embed="${rId}" in document.xml has no matching entry in document.xml.rels — the image reference is broken`);
      }
    }
  }
}

// Returns true if the template's metadata declares a passport image slot or cell.
// When true, the DOCX already contains the passport scan on its own page (rendered
// by docx-preview below), so we must NOT append a second raw passport page.
export function templateHasPassport(template: CvTemplate): boolean {
  const meta = template.metadata as TemplateMetadata | null | undefined;
  // Only imageCells (body cells) count — imageSlots can be in a DOCX header and would repeat.
  return !!(meta?.imageCells?.some((c) => c.purpose === "passport"));
}

