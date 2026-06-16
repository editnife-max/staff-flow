import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import PizZip from "pizzip";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function resolveManagerId(userId: string): Promise<string> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role, manager_id")
    .eq("user_id", userId);
  const mgr = roles?.find((r) => r.role === "manager");
  if (mgr) return userId;
  const staff = roles?.find((r) => r.role === "staff");
  if (staff?.manager_id) return staff.manager_id;
  throw new Response("No manager scope", { status: 403 });
}

// ── Countries ────────────────────────────────────────────────────────────────

export const addCountry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().min(1).max(80), flag: z.string().max(10).default("🌍") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("assignment_countries")
      .insert({ manager_id: managerId, name: data.name.trim(), flag: data.flag })
      .select("id, name, flag, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCountry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const { error } = await supabaseAdmin
      .from("assignment_countries")
      .delete()
      .eq("id", data.id)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Offices ──────────────────────────────────────────────────────────────────

export const addOffice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().min(1).max(120), countryId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const { data: country, error: cErr } = await supabaseAdmin
      .from("assignment_countries")
      .select("id")
      .eq("id", data.countryId)
      .eq("manager_id", managerId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!country) throw new Error("Country not found");
    const { data: row, error } = await supabaseAdmin
      .from("assignment_offices")
      .insert({ manager_id: managerId, country_id: data.countryId, name: data.name.trim() })
      .select("id, name, country_id, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteOffice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const { error } = await supabaseAdmin
      .from("assignment_offices")
      .delete()
      .eq("id", data.id)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── CV Templates ─────────────────────────────────────────────────────────────

export const addCvTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      name: z.string().min(1).max(120),
      file_url: z.string().url(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("cv_templates")
      .insert({ manager_id: managerId, name: data.name.trim(), file_url: data.file_url })
      .select("id, name, file_url, created_at, metadata")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCvTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const { error } = await supabaseAdmin
      .from("cv_templates")
      .delete()
      .eq("id", data.id)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Template analysis helpers ─────────────────────────────────────────────────

interface ImageSlot {
  rId: string;
  target: string;
  cx: number;
  cy: number;
  anchorType: string;
  purpose: "photo" | "passport" | "unknown";
}

interface ImageCellDef {
  label: string;
  purpose: "photo" | "fullphoto" | "passport";
}

interface TemplateMetadata {
  fieldMap: Record<string, string>;
  imageSlots: ImageSlot[];
  imageCells: ImageCellDef[];
}

// Extract all unique cell texts from document.xml for Claude to analyze.
function extractCellTexts(xml: string): string[] {
  const texts = new Set<string>();
  const cellRe = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
  let cm: RegExpExecArray | null;
  while ((cm = cellRe.exec(xml)) !== null) {
    let text = "";
    const tRe = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tRe.exec(cm[1])) !== null) text += tm[1];
    const n = text.replace(/[ ​﻿\s]+/g, " ").trim();
    if (n.length >= 2 && n.length <= 60) texts.add(n);
  }
  return Array.from(texts).slice(0, 150);
}

// Extract image drawing slots from document.xml + _rels/document.xml.rels.
// Reads wp:extent for dimensions and r:embed for the relationship ID.
function extractImageSlots(docXml: string, relsXml: string): Omit<ImageSlot, "purpose">[] {
  const relMap = new Map<string, string>(); // rId → target
  const relRe = /<Relationship\b([^>]*)\/>/g;
  let rm: RegExpExecArray | null;
  while ((rm = relRe.exec(relsXml)) !== null) {
    const a = rm[1];
    const id     = /\bId="([^"]+)"/.exec(a)?.[1];
    const type   = /\bType="([^"]+)"/.exec(a)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(a)?.[1];
    if (id && type?.endsWith("/relationships/image") && target) relMap.set(id, target);
  }
  if (relMap.size === 0) return [];

  const slots: Omit<ImageSlot, "purpose">[] = [];
  const seen = new Set<string>();
  const drawRe = /<w:drawing>([\s\S]*?)<\/w:drawing>/g;
  let dm: RegExpExecArray | null;
  while ((dm = drawRe.exec(docXml)) !== null) {
    const block = dm[1];
    const rId = /\br:embed="([^"]+)"/.exec(block)?.[1];
    if (!rId || seen.has(rId)) continue;
    seen.add(rId);
    const target = relMap.get(rId);
    if (!target) continue;
    const extAttrs = /<wp:extent\b([^/]*)\/?>/.exec(block)?.[1] ?? "";
    const cx = parseInt(/\bcx="(\d+)"/.exec(extAttrs)?.[1] ?? "0");
    const cy = parseInt(/\bcy="(\d+)"/.exec(extAttrs)?.[1] ?? "0");
    if (!cx || !cy) continue;
    slots.push({ rId, target, cx, cy, anchorType: block.includes("<wp:anchor") ? "anchor" : "inline" });
  }
  return slots;
}

// Portrait → photo, landscape → passport, square → unknown.
function classifySlot(s: { cx: number; cy: number }): ImageSlot["purpose"] {
  if (s.cy > s.cx) return "photo";
  if (s.cx > s.cy) return "passport";
  return "unknown";
}

// Call Claude Haiku to map template labels → standard field names AND identify image cells.
async function analyzeFieldsWithClaude(
  cellTexts: string[],
  apiKey: string,
): Promise<{ fieldMap: Record<string, string>; imageCells: ImageCellDef[] }> {
  const EMPTY = { fieldMap: {}, imageCells: [] };
  const STANDARD = [
    "FULL_NAME", "POSITION", "PASSPORT_NUMBER", "PASSPORT_ISSUE_DATE",
    "PASSPORT_EXPIRY_DATE", "PLACE_OF_ISSUE", "ENGLISH_LEVEL", "ARABIC_LEVEL",
    "EDUCATION", "EXPERIENCE", "NATIONALITY", "RELIGION", "DATE_OF_BIRTH", "PLACE_OF_BIRTH",
    "LIVING_TOWN", "AGE", "MARITAL_STATUS", "CHILDREN", "WEIGHT", "HEIGHT", "REMARK",
    "LABOUR_ID", "NARRATIVE", "MEDICAL_STATUS", "TASHEER_DATE", "TASHEER_STATUS",
    "NARRATIVE_PHONE", "COC_STATUS", "TICKET_STATUS", "TICKET_DATE", "LMIS_STATUS",
    "WOKALA_STATUS", "COC_PHONE", "CV_SENT_TO", "CV_SENT_DATE", "MEDICAL_DAYS",
    "EXPERIENCE_COUNTRY", "VISA_STATUS", "SELECTED_BY", "OFFICE", "EMBASSY_DATE",
    "ARRIVAL_CITY", "INSURANCE_STATUS",
  ];

  const systemPrompt =
    `You are analyzing a CV/recruitment DOCX template.\n\n` +
    `Complete TWO tasks:\n\n` +
    `TASK 1 — Field mapping:\n` +
    `Map ONLY labels that match a standard candidate field to one of these names:\n` +
    `${STANDARD.join(", ")}\n` +
    `Skip Arabic-only text, section headers, and decorative text.\n` +
    `IMPORTANT: Some templates mistakenly use a religion value (e.g. "Non-muslim", "Muslim", "Christian") as a row label — this always means the row is for HEIGHT, map it to HEIGHT. Do NOT map such value-like strings to RELIGION.\n\n` +
    `TASK 2 — Image cell identification:\n` +
    `Identify labels that are image/photo placeholders. Classify each as:\n` +
    `- "photo"     → small passport-size photo. Examples: "PHOTO", "Photo", "Photograph", "Picture", "Pic", "4x4", "4X4 PHOTO", "ID Photo", "Passport Size Photo", "Applicant Photo", "صورة", "صورة شخصية"\n` +
    `- "fullphoto" → large or full-body photo. Examples: "FULL PHOTO", "Full Size Photo", "Full Size Picture", "Full Body Photo", "Full Body Picture", "Full Length Photo", "Full Length", "Whole Body", "Body Photo", "صورة كاملة", "صورة كاملة الجسم"\n` +
    `- "passport"  → passport bio-page scan. Examples: "PASSPORT SCAN", "PASSPORT COPY", "Passport Image", "Bio Page", "صورة الجواز", "نسخة الجواز"\n` +
    `Any label that includes the word "photo", "picture", "photograph" or "صورة" without a "full"/"body"/"whole" qualifier should be "photo". Any with "full", "body", "whole", or "length" qualifier should be "fullphoto".\n\n` +
    `Return ONLY valid JSON, no explanation:\n` +
    `{"fieldMap":{"Label":"STANDARD_FIELD"},"imageCells":[{"label":"PHOTO","purpose":"photo"}]}`;

  const userPrompt =
    `These are the unique text labels found in the template's table cells:\n` +
    `${cellTexts.map((t) => `"${t}"`).join(", ")}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) return EMPTY;
    const result = await res.json() as { content: Array<{ type: string; text: string }> };
    const text = result.content.find((c) => c.type === "text")?.text ?? "";
    const match = /\{[\s\S]*\}/.exec(text);
    if (!match) return EMPTY;
    const parsed = JSON.parse(match[0]) as { fieldMap?: unknown; imageCells?: unknown };
    const fieldMap = (parsed.fieldMap && typeof parsed.fieldMap === "object" && !Array.isArray(parsed.fieldMap))
      ? parsed.fieldMap as Record<string, string>
      : {};
    const imageCells = Array.isArray(parsed.imageCells)
      ? (parsed.imageCells as ImageCellDef[]).filter(
          (x) => typeof x.label === "string" && ["photo", "fullphoto", "passport"].includes(x.purpose),
        )
      : [];
    return { fieldMap, imageCells };
  } catch {
    return EMPTY;
  }
}

// Validate, analyze, and upload a DOCX template.
// Uses Claude to map template labels → standard fields and extracts image slot positions.
export const optimizeCvTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      name:       z.string().min(1).max(120),
      fileBase64: z.string().min(1),
      fileName:   z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);

    const buffer = Buffer.from(data.fileBase64, "base64");
    const zip = new PizZip(buffer);
    if (!zip.file("word/document.xml")) throw new Error("Invalid DOCX: word/document.xml not found");

    const docXml  = new TextDecoder().decode(zip.file("word/document.xml")!.asUint8Array());
    const relsEntry = zip.file("word/_rels/document.xml.rels");
    const relsXml = relsEntry ? new TextDecoder().decode(relsEntry.asUint8Array()) : "";

    // Discover image placeholder slots (position + size come from the DOCX itself)
    const rawSlots = extractImageSlots(docXml, relsXml);
    const imageSlots: ImageSlot[] = rawSlots.map((s) => ({ ...s, purpose: classifySlot(s) }));

    // Ask Claude to map this template's label text to standard field names
    const cellTexts = extractCellTexts(docXml);
    let fieldMap: Record<string, string> = {};
    let imageCells: ImageCellDef[] = [];
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && cellTexts.length > 0) {
      ({ fieldMap, imageCells } = await analyzeFieldsWithClaude(cellTexts, apiKey));
    }

    const metadata: TemplateMetadata = { fieldMap, imageSlots, imageCells };

    // Repack via PizZip so client-side PizZip can process it reliably
    const repackedBytes = zip.generate({ type: "uint8array" });

    const path = `cv-templates/${Date.now()}_${Math.random().toString(36).slice(2)}.docx`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("candidate-files")
      .upload(path, repackedBytes, {
        upsert: true,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    if (upErr) throw new Error(upErr.message);

    const { data: urlData } = supabaseAdmin.storage.from("candidate-files").getPublicUrl(path);

    const { data: row, error } = await supabaseAdmin
      .from("cv_templates")
      .insert({ manager_id: managerId, name: data.name.trim(), file_url: urlData.publicUrl, metadata: metadata as any })
      .select("id, name, file_url, created_at, metadata")
      .single();
    if (error) throw new Error(error.message);

    return { template: row };
  });
