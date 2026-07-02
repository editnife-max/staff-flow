import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
const PizZip = (await import("pizzip")).default;

const filePath = join(import.meta.dir, "..", "cv", "cv format n.docx");
const bytes = readFileSync(filePath);
const zip = new PizZip(bytes);
let xml = zip.file("word/document.xml").asText();

function replace1(oldStr: string, newStr: string, label: string) {
  const idx = xml.indexOf(oldStr);
  if (idx === -1) {
    console.error("NOT FOUND: " + label);
    process.exit(1);
  }
  const count = xml.split(oldStr).length - 1;
  if (count > 1) console.warn("WARN: " + count + " occurrences for: " + label);
  xml = xml.replace(oldStr, newStr);
  console.log("OK: " + label);
}

// ── 1. R3[1] vmerge continuation: add invisible NAME label before </w:p></w:tc>
replace1(
  '<w:u w:val="single"/></w:rPr></w:pPr></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="4142" w:type="dxa"/><w:gridSpan w:val="8"/>',
  '<w:u w:val="single"/></w:rPr></w:pPr><w:r><w:rPr><w:color w:val="FFFFFF"/></w:rPr><w:t>NAME</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="4142" w:type="dxa"/><w:gridSpan w:val="8"/>',
  "R3[1] inject NAME label"
);

// ── 2. R3[2]: clear NAME visible text
replace1(
  '<w:b/><w:bCs/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t>NAME</w:t></w:r>',
  '<w:b/><w:bCs/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t></w:t></w:r>',
  "R3[2] clear NAME text"
);

// ── 3. R22[1] vmerge continuation: add invisible CONTACT NO label
replace1(
  '<w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="3973" w:type="dxa"/><w:gridSpan w:val="6"/><w:vMerge w:val="restart"/>',
  '<w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:color w:val="FFFFFF"/></w:rPr><w:t>CONTACT NO</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="3973" w:type="dxa"/><w:gridSpan w:val="6"/><w:vMerge w:val="restart"/>',
  "R22[1] inject CONTACT NO label"
);

// ── 4. R22[2]: clear CONTACT NO visible text (space run + text run)
replace1(
  '<w:r><w:t xml:space="preserve"> </w:t></w:r><w:r><w:rPr><w:color w:val="444440"/></w:rPr><w:t>CONTACT NO</w:t></w:r>',
  "",
  "R22[2] clear CONTACT NO text"
);

// ── 5. R23[3] vmerge continuation (paraId=51EDAEEE): add invisible NATIONALITY label
replace1(
  'w14:paraId="51EDAEEE" w14:textId="77777777" w:rsidR="000C68DF" w:rsidRDefault="000C68DF"><w:pPr><w:widowControl w:val="0"/><w:pBdr><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:between w:val="nil"/></w:pBdr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Dubai" w:eastAsia="Dubai" w:hAnsi="Dubai" w:cs="Dubai"/><w:b/><w:bCs/><w:color w:val="0C3512"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr></w:p>',
  'w14:paraId="51EDAEEE" w14:textId="77777777" w:rsidR="000C68DF" w:rsidRDefault="000C68DF"><w:pPr><w:widowControl w:val="0"/><w:pBdr><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:between w:val="nil"/></w:pBdr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Dubai" w:eastAsia="Dubai" w:hAnsi="Dubai" w:cs="Dubai"/><w:b/><w:bCs/><w:color w:val="0C3512"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:color w:val="FFFFFF"/></w:rPr><w:t>NATIONALITY</w:t></w:r></w:p>',
  "R23[3] inject NATIONALITY label"
);

// ── 6. R24[1]: clear NATIONALITY visible text
replace1(
  "<w:t>NATIONALITY</w:t>",
  "<w:t></w:t>",
  "R24[1] clear NATIONALITY text"
);

// ── 7. Clear hardcoded value cells ────────────────────────────────────────

// R4[3]: 26
replace1(
  '<w:t>26</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="1435"',
  '<w:t></w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="1435"',
  "R4[3] clear 26"
);

// R5[3]: 30/8/1999
replace1("<w:t>30/8/1999</w:t>", "<w:t></w:t>", "R5[3] clear date");

// R7[3]: Housemaid
replace1(
  '<w:t xml:space="preserve">Housemaid </w:t>',
  "<w:t></w:t>",
  "R7[3] clear Housemaid"
);

// R7[4]: Arabic housemaid
replace1("<w:t>عاملة منزلية</w:t>", "<w:t></w:t>", "R7[4] clear Arabic housemaid");

// R8[3]: First time
replace1("<w:t>First time</w:t>", "<w:t></w:t>", "R8[3] clear First time");

// R8[4]: Arabic first time
replace1("<w:t>لم يسبق لها العمل</w:t>", "<w:t></w:t>", "R8[4] clear Arabic first time");

// R9[3]: Good
replace1('<w:t xml:space="preserve">Good  </w:t>', "<w:t></w:t>", "R9[3] clear Good");

// R9[4]: dash (use unique trailing context to avoid collisions)
replace1(
  '<w:t xml:space="preserve">- </w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="1435" w:type="dxa"/><w:gridSpan w:val="2"/><w:vAlign w:val="center"/>',
  '<w:t></w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="1435" w:type="dxa"/><w:gridSpan w:val="2"/><w:vAlign w:val="center"/>',
  "R9[4] clear dash"
);

// R10[3]: Muslim
replace1('<w:t xml:space="preserve">Muslim  </w:t>', "<w:t></w:t>", "R10[3] clear Muslim");

// R10[4]: Arabic Muslim
replace1("<w:t>مسلمة</w:t>", "<w:t></w:t>", "R10[4] clear Arabic Muslim");

// R11[3]: Primary
replace1('<w:t xml:space="preserve">Primary  </w:t>', "<w:t></w:t>", "R11[3] clear Primary");

// R11[4]: إبتدائي (two runs - clear both)
replace1(
  '<w:t>إبتدائي</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Dubai" w:eastAsia="Dubai" w:hAnsi="Dubai" w:cs="Dubai"/><w:color w:val="074F6A"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">   </w:t></w:r>',
  "<w:t></w:t></w:r>",
  "R11[4] clear Arabic Primary"
);

// R13[3]: Married
replace1(
  '<w:t xml:space="preserve">                 Married </w:t>',
  "<w:t></w:t>",
  "R13[3] clear Married"
);

// R13[4]: Arabic Married
replace1("<w:t>متزوجة</w:t>", "<w:t></w:t>", "R13[4] clear Arabic Married");

// R14[3]: 2 (No. of kids) - unique context with gridSpan
replace1(
  '<w:t>2</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="1435" w:type="dxa"/><w:gridSpan w:val="2"/><w:vAlign',
  '<w:t></w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="1435" w:type="dxa"/><w:gridSpan w:val="2"/><w:vAlign',
  "R14[3] clear 2"
);

// R15[3]: 55 (Weight)
replace1(
  '<w:t>55</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="1435"',
  '<w:t></w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="1435"',
  "R15[3] clear 55"
);

// R16[3]: 155 (Height)
replace1(
  '<w:t>155</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="1435"',
  '<w:t></w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="1435"',
  "R16[3] clear 155"
);

// Save back
zip.file("word/document.xml", xml);
const out = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
writeFileSync(filePath, out);
console.log("\nSaved: cv/cv format n.docx");
