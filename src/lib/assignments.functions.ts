import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import PizZip from "pizzip";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ── DOCX template optimization helpers ───────────────────────────────────────

const EXPECTED_CV_LABELS = [
  "FULL NAME", "POSITION", "NUMBER", "DATE OF ISSUE", "DATE OF EXPIRY",
  "PLACE OF ISSUE", "ENGLISH", "ARABIC", "EXPERIENCE", "NATIONALITY",
  "RELIGION", "DATE OF BIRTH", "PLACE OF BIRTH", "LIVING TOWN", "AGE",
  "MARITAL STATUS", "CHILDREN", "WEIGHT", "HEIGHT", "REMARK",
];

function normL(s: string) {
  return s.replace(/[   ]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
}

function cellTxt(xml: string, from: number, to: number): string {
  let text = "";
  let p = from;
  while (p < to) {
    const idx = xml.indexOf("<w:t", p);
    if (idx === -1 || idx >= to) break;
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

function nextTc(xml: string, from: number): number {
  let p = from;
  while (p < xml.length) {
    const idx = xml.indexOf("<w:tc", p);
    if (idx === -1) return -1;
    const ch = xml[idx + 5];
    if (ch === ">" || ch === " " || ch === "\n" || ch === "\t") return idx;
    p = idx + 1;
  }
  return -1;
}

function xmlE(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function extractLabels(xml: string): string[] {
  const seen = new Set<string>();
  let pos = 0;
  while (pos < xml.length) {
    const cs = nextTc(xml, pos);
    if (cs === -1) break;
    const ce = xml.indexOf("</w:tc>", cs);
    if (ce === -1) break;
    const t = normL(cellTxt(xml, cs, ce));
    if (t) seen.add(t);
    pos = ce + 7;
  }
  return [...seen];
}

function applyFixes(xml: string, mapping: Record<string, string>): string {
  if (Object.keys(mapping).length === 0) return xml;
  let result = "";
  let pos = 0;
  while (pos < xml.length) {
    const cs = nextTc(xml, pos);
    if (cs === -1) { result += xml.slice(pos); break; }
    const ce = xml.indexOf("</w:tc>", cs);
    if (ce === -1) { result += xml.slice(pos); break; }
    result += xml.slice(pos, cs);
    const norm = normL(cellTxt(xml, cs, ce));
    const fix = mapping[norm];
    if (fix) {
      let first = true;
      const fixed = xml.slice(cs, ce + 7).replace(/<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g, (_m, attrs) => {
        if (first) {
          first = false;
          const sp = fix.includes(" ") ? ' xml:space="preserve"' : (attrs ?? "");
          return `<w:t${sp}>${xmlE(fix)}</w:t>`;
        }
        return `<w:t${attrs ?? ""}></w:t>`;
      });
      result += fixed;
    } else {
      result += xml.slice(cs, ce + 7);
    }
    pos = ce + 7;
  }
  return result;
}

async function claudeLabelMapping(labels: string[]): Promise<Record<string, string>> {
  // Workers runtime: vars come from .dev.vars / wrangler secrets (via globalThis or process.env)
  const apiKey =
    process.env.ANTHROPIC_API_KEY ??
    (typeof globalThis !== "undefined" && (globalThis as Record<string, unknown>).ANTHROPIC_API_KEY as string | undefined);
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set — add it to .dev.vars (dev) or as a Wrangler secret (prod)");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `You are a CV template field analyzer for a recruitment system.

These text labels were found in the cells of a DOCX template:
${labels.map((l) => `- "${l}"`).join("\n")}

The system requires exactly these field names:
${EXPECTED_CV_LABELS.join(", ")}

Return ONLY a valid JSON object mapping each label that needs renaming to the correct field name.
Rules:
- Only include labels that do NOT already exactly match an expected field name
- Only include labels that clearly correspond to one of the expected fields
- Omit labels that don't correspond to any expected field
- Return {} if no corrections needed

Example: {"Name": "FULL NAME", "Passport No": "NUMBER", "D.O.B": "DATE OF BIRTH"}`,
      }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const json = await res.json() as { content: { type: string; text: string }[] };
  const text = json.content[0]?.text?.trim() ?? "{}";
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? (JSON.parse(match[0]) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

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
    // Verify the country belongs to this manager
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
      .select("id, name, file_url, created_at")
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

// Optimize a DOCX template using Claude (one-time on upload), then save it.
// PDF templates are uploaded directly via addCvTemplate without optimization.
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

    // Decode base64 → Buffer, unpack DOCX
    const buffer = Buffer.from(data.fileBase64, "base64");
    const zip    = new PizZip(buffer);
    const entry  = zip.file("word/document.xml");
    if (!entry) throw new Error("Invalid DOCX: word/document.xml not found");
    let xml = new TextDecoder("utf-8").decode(entry.asUint8Array());

    // Ask Claude to map any non-standard label → correct CV field name
    const rawLabels = extractLabels(xml);
    const rawMapping = await claudeLabelMapping(rawLabels);

    // Normalize mapping keys to match how extractLabels normalizes cell text
    const mapping: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawMapping)) mapping[normL(k)] = v;

    // Apply corrections and repack
    xml = applyFixes(xml, mapping);
    zip.file("word/document.xml", new TextEncoder().encode(xml));
    const optimizedBytes = zip.generate({ type: "uint8array" });

    // Upload optimized DOCX to storage
    const ext  = (data.fileName.split(".").pop() ?? "docx").toLowerCase();
    const path = `cv-templates/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("candidate-files")
      .upload(path, optimizedBytes, {
        upsert: true,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    if (upErr) throw new Error(upErr.message);

    const { data: urlData } = supabaseAdmin.storage.from("candidate-files").getPublicUrl(path);

    const { data: row, error } = await supabaseAdmin
      .from("cv_templates")
      .insert({ manager_id: managerId, name: data.name.trim(), file_url: urlData.publicUrl })
      .select("id, name, file_url, created_at")
      .single();
    if (error) throw new Error(error.message);

    return { template: row, corrections: Object.keys(mapping).length };
  });
