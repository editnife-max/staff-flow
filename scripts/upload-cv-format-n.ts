import { readFileSync } from "fs";
import { join } from "path";

const SUPABASE_URL = "https://zkdaesxvkephaekxprsh.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprZGFlc3h2a2VwaGFla3hwcnNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk1ODc0NywiZXhwIjoyMDk0NTM0NzQ3fQ.7wTHHyMCaqTfFRC2Ms7afseBSV9y-6c0_Ds83B5SbB8";
const BUCKET = "candidate-files";
const STORAGE_PATH = "cv-templates/1782938896246_4ducchlh1xn.docx";

const filePath = join(import.meta.dir, "..", "cv", "cv format n.docx");
const bytes = new Uint8Array(readFileSync(filePath));

const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${STORAGE_PATH}`;
const res = await fetch(url, {
  method: "POST",
  headers: {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "x-upsert": "true",
  },
  body: bytes,
});

if (!res.ok) {
  console.error("Upload failed:", res.status, await res.text());
  process.exit(1);
}
console.log("Uploaded successfully:", STORAGE_PATH);
