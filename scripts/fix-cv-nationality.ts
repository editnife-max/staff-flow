import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
const PizZip = (await import("pizzip")).default;

const filePath = join(import.meta.dir, "..", "cv", "cv format n.docx");
const bytes = readFileSync(filePath);
const zip = new PizZip(bytes);
let xml = zip.file("word/document.xml").asText();

// ── 1. Restore NATIONALITY invisible label in R23[3]
const old1 = '<w:color w:val="FFFFFF"/></w:rPr><w:t></w:t></w:r></w:p></w:tc></w:tr>';
const new1 = '<w:color w:val="FFFFFF"/></w:rPr><w:t>NATIONALITY</w:t></w:r></w:p></w:tc></w:tr>';
if (xml.indexOf(old1) === -1) { console.error("NOT FOUND: R23[3] restore"); process.exit(1); }
xml = xml.replace(old1, new1);
console.log("OK: R23[3] NATIONALITY restored");

// ── 2. Clear NATIONALITY in R24[1] using color 0C3512 as unique context
const old2 = '<w:color w:val="0C3512"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>NATIONALITY</w:t>';
const new2 = '<w:color w:val="0C3512"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t></w:t>';
if (xml.indexOf(old2) === -1) { console.error("NOT FOUND: R24[1] NATIONALITY"); process.exit(1); }
const count = xml.split(old2).length - 1;
if (count > 1) console.warn("WARN: " + count + " occurrences");
xml = xml.replace(old2, new2);
console.log("OK: R24[1] NATIONALITY cleared");

zip.file("word/document.xml", xml);
const out = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
writeFileSync(filePath, out);
console.log("Saved: cv/cv format n.docx");
