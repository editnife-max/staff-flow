import { readFileSync } from "fs";
import { join } from "path";

const SUPABASE_URL = "https://zkdaesxvkephaekxprsh.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprZGFlc3h2a2VwaGFla3hwcnNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk1ODc0NywiZXhwIjoyMDk0NTM0NzQ3fQ.7wTHHyMCaqTfFRC2Ms7afseBSV9y-6c0_Ds83B5SbB8";
const MANAGER_ID = "8722f5ae-cf60-4b65-82f2-e628489104e0";
const BUCKET = "candidate-files";

const templates = [
  { file: "cv format n.docx", name: "CV Format N" },
  { file: "JAWA CV format.docx", name: "JAWA CV Format" },
  { file: "monaco sample cv.docx", name: "Monaco Sample CV" },
  { file: "TADBEER CV FORM.docx", name: "TADBEER CV Form" },
];

const authHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

async function uploadFile(bytes: Uint8Array, storagePath: string): Promise<string> {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Storage upload failed (${res.status}): ${body}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

async function insertRow(name: string, file_url: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/cv_templates`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ name, file_url, manager_id: MANAGER_ID }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DB insert failed (${res.status}): ${body}`);
  }
}

const cvDir = join(import.meta.dir, "..", "cv");

for (const { file, name } of templates) {
  const filePath = join(cvDir, file);
  const bytes = new Uint8Array(readFileSync(filePath));
  const slug = `${Date.now()}_${Math.random().toString(36).slice(2)}.docx`;
  const storagePath = `cv-templates/${slug}`;

  process.stdout.write(`Uploading "${name}" ... `);
  const publicUrl = await uploadFile(bytes, storagePath);
  await insertRow(name, publicUrl);
  console.log("done");
}

console.log("All templates seeded.");
