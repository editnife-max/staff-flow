import type { Candidate } from "./docx-fill";
import { calcAge } from "./utils";

function skillCheck(c: Candidate, ...terms: string[]): boolean {
  const s = (c.skills ?? "").toLowerCase();
  return terms.some((t) => s.includes(t.toLowerCase()));
}

async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { mode: "cors" });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function fetchImageBytes(url: string): Promise<ArrayBuffer | null> {
  try {
    const resp = await fetch(url, { mode: "cors" });
    if (!resp.ok) return null;
    return await resp.arrayBuffer();
  } catch {
    return null;
  }
}

function fmtDob(dob: string | null | undefined): string {
  if (!dob) return "—";
  try {
    return new Date(dob + "T00:00:00").toLocaleDateString("en-GB", {
      day: "2-digit", month: "long", year: "numeric",
    });
  } catch {
    return dob;
  }
}

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size) as T[]);
  return out;
}

const SKILLS_MAP = [
  { label: "ARABIC COOKING", terms: ["arabic cooking", "cooking"] },
  { label: "TUTORING",       terms: ["tutoring"] },
  { label: "BABY SITTING",   terms: ["babysitting", "baby sitting"] },
  { label: "CLEANING",       terms: ["cleaning"] },
  { label: "WASHING",        terms: ["washing"] },
  { label: "IRONING",        terms: ["ironing"] },
  { label: "COOKING",        terms: ["cooking"] },
  { label: "CHILDREN CARE",  terms: ["childcare", "children care", "child care"] },
] as const;

// ─── PDF ─────────────────────────────────────────────────────────────────────

export async function downloadNormalCvPdf(c: Candidate): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W = 210, H = 297;
  const ML = 10, MR = 10;
  const CW = W - ML - MR; // 190

  const fill = (r: number, g: number, b: number) => doc.setFillColor(r, g, b);
  const pen  = (r: number, g: number, b: number) => doc.setDrawColor(r, g, b);
  const ink  = (r: number, g: number, b: number) => doc.setTextColor(r, g, b);

  // ── HEADER ──
  fill(26, 58, 82);
  doc.rect(0, 0, W, 22, "F");
  fill(92, 184, 196);
  doc.rect(W / 2, 0, W / 2, 22, "F");

  ink(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("RECRUITMENT CV", ML, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("YOUR TRUSTED PARTNER", ML, 15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("QUALIFIED  ·  RELIABLE  ·  TRUSTWORTHY", W / 2 + 4, 12.5);

  let y = 26;

  // ── PHOTO ──
  const photoX = ML, photoY = y;
  const photoW = 42, photoH = 52;

  const photoDataUrl = c.photo_url ? await fetchImageDataUrl(c.photo_url) : null;
  pen(200, 210, 220);
  doc.setLineWidth(0.3);
  if (photoDataUrl) {
    const ext = photoDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
    try { doc.addImage(photoDataUrl, ext, photoX, photoY, photoW, photoH); } catch { /* skip */ }
    doc.rect(photoX, photoY, photoW, photoH, "S");
  } else {
    fill(240, 242, 245);
    doc.rect(photoX, photoY, photoW, photoH, "FD");
    ink(170, 180, 190);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("NO PHOTO", photoX + photoW / 2, photoY + photoH / 2, { align: "center" });
  }

  // ── INFO PANEL (right of photo) ──
  const infoX = ML + photoW + 4;
  const infoW = CW - photoW - 4;
  const rh = 7;

  // Name banner
  fill(26, 58, 82);
  doc.rect(infoX, y, infoW, 9, "F");
  ink(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(c.full_name || "—", infoX + 3, y + 6.2, { maxWidth: infoW - 6 });
  y += 9;

  const infoRow = (label: string, value: string, alt = false) => {
    fill(alt ? 248 : 255, alt ? 250 : 255, alt ? 252 : 255);
    doc.rect(infoX, y, infoW, rh, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); ink(120, 140, 160);
    doc.text(label, infoX + 3, y + 3);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(30, 30, 40);
    doc.text(value || "—", infoX + 3, y + 6.2, { maxWidth: infoW - 6 });
    y += rh;
  };

  infoRow("CONTACT NO", c.narrative_phone || "—");

  // Religion / Height / Weight — three thirds
  const thirdW = infoW / 3;
  fill(248, 250, 252);
  doc.rect(infoX, y, infoW, rh, "F");
  ([ ["RELIGION", c.religion || "—"],
     ["HEIGHT (CM)", c.height ? String(c.height) : "—"],
     ["WEIGHT (KG)", c.weight ? String(c.weight) : "—"],
  ] as [string, string][]).forEach(([lbl, val], i) => {
    const tx = infoX + i * thirdW;
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); ink(120, 140, 160);
    doc.text(lbl, tx + 3, y + 3);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(30, 30, 40);
    doc.text(val, tx + 3, y + 6.2, { maxWidth: thirdW - 6 });
  });
  y += rh;

  // Position / Contract — two halves
  const halfW = infoW / 2;
  ([
    ["POSITION APPLIED", c.occupation || "HOUSE MAID", "CONTRACT PERIOD", "2 YEARS", false],
    ["PASSPORT NUMBER", c.passport_number || "—", "SALARY", "—", true],
  ] as [string, string, string, string, boolean][]).forEach(([l1, v1, l2, v2, alt]) => {
    fill(alt ? 248 : 255, alt ? 250 : 255, alt ? 252 : 255);
    doc.rect(infoX, y, infoW, rh, "F");
    [[l1, v1, 0], [l2, v2, halfW]].forEach(([lbl, val, offset]) => {
      const tx = infoX + (offset as number);
      doc.setFont("helvetica", "bold"); doc.setFontSize(7); ink(120, 140, 160);
      doc.text(lbl as string, tx + 3, y + 3);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(30, 30, 40);
      doc.text(val as string, tx + 3, y + 6.2, { maxWidth: halfW - 6 });
    });
    y += rh;
  });

  // Align below photo
  if (y < photoY + photoH) y = photoY + photoH;
  y += 5;

  // ── SECTION HEADER ──
  const section = (title: string) => {
    fill(92, 184, 196);
    doc.rect(ML, y, CW, 7, "F");
    ink(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    doc.text(title, ML + 4, y + 5);
    y += 7;
  };

  // ── BILINGUAL ROW ──
  let rowAlt = false;
  const biRow = (labelEn: string, value: string, labelAr: string) => {
    fill(rowAlt ? 248 : 255, rowAlt ? 250 : 255, rowAlt ? 252 : 255);
    doc.rect(ML, y, CW, rh, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(120, 140, 160);
    doc.text(labelEn, ML + 3, y + 5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(30, 30, 40);
    doc.text(value || "—", ML + 60, y + 5, { maxWidth: CW / 2 - 4 });
    // Arabic label on far right (latin fallback)
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(150, 160, 170);
    doc.text(labelAr, ML + CW - 3, y + 5, { align: "right" });
    pen(220, 228, 235); doc.setLineWidth(0.2);
    doc.line(ML, y + rh, ML + CW, y + rh);
    y += rh;
    rowAlt = !rowAlt;
  };

  const age = calcAge(c.dob) ?? c.age;

  section("APPLICANT DETAILS");
  biRow("NATIONALITY",    c.country || "ETHIOPIAN",              "الجنسية");
  biRow("ADDRESS",        c.living_town || c.birth_place || "—", "العنوان");
  biRow("DATE OF BIRTH",  fmtDob(c.dob),                         "تاريخ الميلاد");
  biRow("AGE",            age ? `${age} YEARS` : "—",       "العمر");
  biRow("PLACE OF BIRTH", c.birth_place || "—",             "مكان الميلاد");
  biRow("MARITAL STATUS", c.marital_status || "—",          "الحالة الاجتماعية");
  biRow("CHILDREN",       c.children != null ? String(c.children) : "—", "عدد الأطفال");
  y += 2;

  section("LANGUAGE & EDUCATION");
  biRow("ENGLISH",   c.english_level || "—", "اللغة الإنجليزية");
  biRow("ARABIC",    c.arabic_level  || "—", "اللغة العربية");
  biRow("EDUCATION", c.education     || "—", "التعليم");
  y += 2;

  if (c.experience === "Yes") {
    section("EXPERIENCE ABROAD");
    biRow("COUNTRY", c.experience_country || "—", "الدولة");
    biRow("PERIOD",  c.experience_years ? `${c.experience_years} YEARS` : "—", "مدة");
    y += 2;
  }

  section("SKILLS  —  المهارات");
  const skillCols = 4;
  const skillW = CW / skillCols;
  const skillH = 8;
  SKILLS_MAP.forEach((sk, i) => {
    const col = i % skillCols;
    const row = Math.floor(i / skillCols);
    const sx = ML + col * skillW;
    const sy = y + row * skillH;
    const has = skillCheck(c, ...sk.terms);

    fill(has ? 232 : 255, has ? 250 : 255, has ? 242 : 255);
    doc.rect(sx, sy, skillW, skillH, "F");
    pen(210, 220, 228); doc.setLineWidth(0.2);
    doc.rect(sx, sy, skillW, skillH, "S");

    const cbSz = 4, cbX = sx + 3, cbY = sy + (skillH - cbSz) / 2;
    if (has) {
      fill(92, 184, 196);
      doc.rect(cbX, cbY, cbSz, cbSz, "F");
      ink(255, 255, 255);
      doc.setFont("helvetica", "bold"); doc.setFontSize(7);
      doc.text("✓", cbX + cbSz / 2, cbY + cbSz - 0.5, { align: "center" });
    } else {
      fill(255, 255, 255); pen(180, 190, 200);
      doc.rect(cbX, cbY, cbSz, cbSz, "FD");
    }
    ink(has ? 20 : 60, has ? 80 : 70, has ? 50 : 80);
    doc.setFont("helvetica", has ? "bold" : "normal");
    doc.setFontSize(7.5);
    doc.text(sk.label, sx + 9, sy + skillH / 2 + 1.5);
  });

  // ── FOOTER ──
  fill(26, 58, 82);
  doc.rect(0, H - 9, W, 9, "F");
  ink(255, 255, 255);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  doc.text(
    "RECRUITMENT CV  ·  QUALIFIED  ·  RELIABLE  ·  TRUSTWORTHY",
    W / 2, H - 4, { align: "center" },
  );

  doc.save(`${c.full_name || "Candidate"} — Normal CV.pdf`);
}

// ─── DOCX ────────────────────────────────────────────────────────────────────

export async function downloadNormalCvDocx(c: Candidate): Promise<void> {
  const {
    Document, Packer, Table, TableRow, TableCell,
    Paragraph, TextRun, ImageRun,
    WidthType, AlignmentType, HeightRule, VerticalAlign,
    BorderStyle, ShadingType,
  } = await import("docx");

  const NAVY  = "1A3A52";
  const TEAL  = "5CB8C4";
  const LIGHT = "F5F7FA";
  const WHITE = "FFFFFF";

  const none = (c = "auto") => ({ style: BorderStyle.NONE, size: 0, color: c });
  const thin = (c = "D0D8DC") => ({ style: BorderStyle.SINGLE, size: 4, color: c });
  const noBorders  = { top: none(), bottom: none(), left: none(), right: none(), insideH: none(), insideV: none() };
  const cellBorder = { top: thin(), bottom: thin(), left: thin(), right: thin() };

  const age = calcAge(c.dob) ?? c.age;

  // Photo bytes
  const photoBytes = c.photo_url ? await fetchImageBytes(c.photo_url) : null;

  // Helper: build a single data cell
  const cell = (
    text: string,
    opts: {
      bold?: boolean; size?: number; color?: string; shade?: string;
      width?: number; colSpan?: number; rowSpan?: number;
      vAlign?: typeof VerticalAlign.CENTER; align?: string;
      borders?: object;
    } = {},
  ) => {
    const {
      bold = false, size = 18, color = "1E1E28", shade,
      width, colSpan, rowSpan,
      vAlign = VerticalAlign.CENTER,
      align = AlignmentType.LEFT,
      borders = cellBorder,
    } = opts;
    return new TableCell({
      ...(colSpan ? { columnSpan: colSpan } : {}),
      ...(rowSpan ? { rowSpan } : {}),
      ...(width   ? { width: { size: width, type: WidthType.DXA } } : {}),
      verticalAlign: vAlign,
      shading: shade ? { type: ShadingType.CLEAR, fill: shade } : undefined,
      borders,
      children: [new Paragraph({
        alignment: align as any,
        children: [new TextRun({ text, bold, size, color, font: "Arial" })],
      })],
    });
  };

  const sectionRow = (title: string, cols: number) => new TableRow({
    height: { value: 340, rule: HeightRule.EXACT },
    children: [new TableCell({
      columnSpan: cols,
      shading: { type: ShadingType.CLEAR, fill: TEAL },
      borders: cellBorder,
      children: [new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 18, color: WHITE, font: "Arial" })],
      })],
    })],
  });

  const biRow = (labelEn: string, value: string, labelAr: string) => new TableRow({
    height: { value: 340, rule: HeightRule.EXACT },
    children: [
      cell(labelEn,   { bold: true, size: 16, color: "6B7E8C", width: 2800 }),
      cell(value || "—", { size: 18, width: 3600 }),
      cell(value || "—", { size: 18, width: 3000 }),
      cell(labelAr,   { bold: true, size: 16, color: "6B7E8C", width: 2400, align: AlignmentType.RIGHT }),
    ],
  });

  // Photo cell spanning top rows
  const photoCell = photoBytes
    ? new TableCell({
        rowSpan: 6,
        width: { size: 2800, type: WidthType.DXA },
        verticalAlign: VerticalAlign.TOP,
        borders: cellBorder,
        children: [new Paragraph({
          children: [new ImageRun({
            data: photoBytes,
            transformation: { width: 105, height: 130 },
            type: "jpg",
          })],
        })],
      })
    : new TableCell({
        rowSpan: 6,
        width: { size: 2800, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, fill: LIGHT },
        borders: cellBorder,
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Photo", size: 18, color: "AAAAAA", font: "Arial" })],
        })],
      });

  const skillRows = chunk(SKILLS_MAP, 2).map((pair) => new TableRow({
    height: { value: 340, rule: HeightRule.EXACT },
    children: pair.flatMap((sk) => {
      const has = skillCheck(c, ...sk.terms);
      return [
        cell(has ? "☑" : "☐", { bold: has, size: 18, color: has ? "0D6E3F" : "888888", width: 600 }),
        cell(sk.label, { bold: has, size: 18, color: has ? "0D6E3F" : "1E1E28", width: 6200 }),
      ];
    }),
  }));

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        // ── Header table ──
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders,
          rows: [new TableRow({
            height: { value: 800, rule: HeightRule.EXACT },
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, fill: NAVY },
                borders: noBorders,
                children: [
                  new Paragraph({ children: [new TextRun({ text: "RECRUITMENT CV", bold: true, size: 32, color: WHITE, font: "Arial" })] }),
                  new Paragraph({ children: [new TextRun({ text: "YOUR TRUSTED PARTNER", size: 14, color: "C0D8E8", font: "Arial" })] }),
                ],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, fill: TEAL },
                borders: noBorders,
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "QUALIFIED  ·  RELIABLE  ·  TRUSTWORTHY", bold: true, size: 18, color: WHITE, font: "Arial" })],
                })],
              }),
            ],
          })],
        }),

        new Paragraph({ children: [], spacing: { after: 80 } }),

        // ── Main CV table ──
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders,
          rows: [
            // Name row
            new TableRow({
              height: { value: 560, rule: HeightRule.EXACT },
              children: [
                photoCell,
                new TableCell({
                  columnSpan: 3,
                  shading: { type: ShadingType.CLEAR, fill: NAVY },
                  borders: cellBorder,
                  verticalAlign: VerticalAlign.CENTER,
                  children: [new Paragraph({
                    children: [new TextRun({ text: c.full_name || "—", bold: true, size: 28, color: WHITE, font: "Arial" })],
                  })],
                }),
              ],
            }),
            // Contact row
            new TableRow({
              height: { value: 340, rule: HeightRule.EXACT },
              children: [
                cell("CONTACT NO", { bold: true, size: 16, color: "6B7E8C", width: 2800 }),
                new TableCell({
                  columnSpan: 3,
                  borders: cellBorder,
                  children: [new Paragraph({ children: [new TextRun({ text: c.narrative_phone || "—", size: 18, font: "Arial" })] })],
                }),
              ],
            }),
            // Religion / Height / Weight
            new TableRow({
              height: { value: 340, rule: HeightRule.EXACT },
              children: [
                cell("RELIGION", { bold: true, size: 16, color: "6B7E8C", width: 2800 }),
                cell(c.religion || "—", { size: 18, width: 1400 }),
                cell(`HEIGHT: ${c.height || "—"} CM`, { bold: true, size: 16, color: "6B7E8C", width: 2800 }),
                cell(`WEIGHT: ${c.weight || "—"} KG`, { size: 18, width: 2800 }),
              ],
            }),
            // Position / Contract
            new TableRow({
              height: { value: 340, rule: HeightRule.EXACT },
              children: [
                cell("POSITION APPLIED", { bold: true, size: 16, color: "6B7E8C", width: 2800 }),
                cell(c.occupation || "HOUSE MAID", { size: 18, width: 1400 }),
                cell("CONTRACT PERIOD", { bold: true, size: 16, color: "6B7E8C", width: 2800 }),
                cell("2 YEARS", { size: 18, width: 2800 }),
              ],
            }),
            // Passport / Salary
            new TableRow({
              height: { value: 340, rule: HeightRule.EXACT },
              children: [
                cell("PASSPORT NUMBER", { bold: true, size: 16, color: "6B7E8C", width: 2800 }),
                cell(c.passport_number || "—", { size: 18, width: 1400 }),
                cell("SALARY", { bold: true, size: 16, color: "6B7E8C", width: 2800 }),
                cell("—", { size: 18, width: 2800 }),
              ],
            }),

            // ── Application Details ──
            sectionRow("APPLICANT DETAILS", 4),
            biRow("NATIONALITY",    c.country || "ETHIOPIAN",                 "الجنسية"),
            biRow("ADDRESS",        c.living_town || c.birth_place || "—", "العنوان"),
            biRow("DATE OF BIRTH",  fmtDob(c.dob),                            "تاريخ الميلاد"),
            biRow("AGE",            age ? `${age} YEARS` : "—",          "العمر"),
            biRow("PLACE OF BIRTH", c.birth_place || "—",                "مكان الميلاد"),
            biRow("MARITAL STATUS", c.marital_status || "—",             "الحالة الاجتماعية"),
            biRow("CHILDREN",       c.children != null ? String(c.children) : "—", "عدد الأطفال"),

            // ── Language & Education ──
            sectionRow("LANGUAGE & EDUCATION", 4),
            biRow("ENGLISH",   c.english_level || "—", "اللغة الإنجليزية"),
            biRow("ARABIC",    c.arabic_level  || "—", "اللغة العربية"),
            biRow("EDUCATION", c.education     || "—", "التعليم"),

            // ── Experience (conditional) ──
            ...(c.experience === "Yes" ? [
              sectionRow("EXPERIENCE ABROAD", 4),
              biRow("COUNTRY", c.experience_country || "—", "الدولة"),
              biRow("PERIOD",  c.experience_years ? `${c.experience_years} YEARS` : "—", "مدة"),
            ] : []),

            // ── Skills ──
            sectionRow("SKILLS  —  المهارات", 4),
            ...skillRows,
          ],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${c.full_name || "Candidate"} — Normal CV.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
