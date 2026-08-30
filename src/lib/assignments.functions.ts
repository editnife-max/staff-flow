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
    // Fetch the office name before deletion so we can clear cv_sent_to on candidates
    const { data: office } = await supabaseAdmin
      .from("assignment_offices")
      .select("name")
      .eq("id", data.id)
      .eq("manager_id", managerId)
      .maybeSingle();
    if (!office) throw new Error("Office not found");
    const { error } = await supabaseAdmin
      .from("assignment_offices")
      .delete()
      .eq("id", data.id)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    // Clear cv_sent_to for all candidates that were assigned to this office
    await supabaseAdmin
      .from("candidates")
      .update({ cv_sent_to: null, cv_sent_date: null } as any)
      .eq("cv_sent_to", office.name)
      .eq("manager_id", managerId);
    return { ok: true };
  });

export const lockOffice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), locked: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const { error } = await supabaseAdmin
      .from("assignment_offices")
      .update({ is_locked: data.locked } as any)
      .eq("id", data.id)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);

    let redistributed = 0;
    if (data.locked) {
      const { data: office } = await supabaseAdmin
        .from("assignment_offices")
        .select("name")
        .eq("id", data.id)
        .eq("manager_id", managerId)
        .maybeSingle();

      if (office?.name) {
        const { data: unlocked } = await supabaseAdmin
          .from("assignment_offices")
          .select("name")
          .eq("manager_id", managerId)
          .eq("is_locked", false)
          .neq("id", data.id);

        const { data: toRedistribute } = await supabaseAdmin
          .from("candidates")
          .select("id")
          .eq("manager_id", managerId)
          .eq("cv_sent_to", office.name);

        if (toRedistribute?.length && unlocked?.length) {
          for (let i = 0; i < toRedistribute.length; i++) {
            const targetOffice = unlocked[i % unlocked.length].name;
            await supabaseAdmin
              .from("candidates")
              .update({ cv_sent_to: targetOffice } as any)
              .eq("id", toRedistribute[i].id);
          }
          redistributed = toRedistribute.length;
        } else if (toRedistribute?.length && !unlocked?.length) {
          // No other offices available — clear assignment instead
          await supabaseAdmin
            .from("candidates")
            .update({ cv_sent_to: null, cv_sent_date: null } as any)
            .eq("manager_id", managerId)
            .eq("cv_sent_to", office.name);
          redistributed = toRedistribute.length;
        }
      }
    }

    return { ok: true, redistributed };
  });

export const saveMusanedCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().min(1).max(200), password: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ musaned_email: data.email, musaned_password: data.password })
      .eq("id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cleanOrphanedCvSentTo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const managerId = await resolveManagerId(context.userId);
    const [{ data: offices }, { data: agencies }] = await Promise.all([
      supabaseAdmin.from("assignment_offices").select("name").eq("manager_id", managerId),
      supabaseAdmin.from("foreign_agencies").select("name").eq("manager_id", managerId),
    ]);
    const validNames = new Set([
      ...(offices ?? []).map((o) => o.name),
      ...(agencies ?? []).map((a) => a.name),
    ]);
    const { data: assigned } = await supabaseAdmin
      .from("candidates")
      .select("id, cv_sent_to")
      .eq("manager_id", managerId)
      .not("cv_sent_to", "is", null);
    const orphanedIds = (assigned ?? [])
      .filter((c) => c.cv_sent_to && !validNames.has(c.cv_sent_to))
      .map((c) => c.id);
    if (orphanedIds.length === 0) return { cleared: 0 };
    await supabaseAdmin
      .from("candidates")
      .update({ cv_sent_to: null, cv_sent_date: null } as any)
      .in("id", orphanedIds);
    return { cleared: orphanedIds.length };
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
  purpose: "photo" | "fullphoto" | "passport" | "unknown";
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

// Extract the full document layout: headings (paragraphs before tables) + table grids.
// Each table is a 2D array of cell texts; image cells are marked "[IMAGE]".
interface DocStructure {
  headings: string[];
  tables: string[][][];
}

function extractDocumentStructure(xml: string): DocStructure {
  // Paragraphs before the first table = document title / section headers
  const headings: string[] = [];
  const firstTbl = xml.indexOf("<w:tbl");
  if (firstTbl > 0) {
    const before = xml.slice(0, firstTbl);
    const pRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
    let pm: RegExpExecArray | null;
    while ((pm = pRe.exec(before)) !== null) {
      const text = [...pm[1].matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)]
        .map((m) => m[1]).join("").replace(/\s+/g, " ").trim();
      if (text.length >= 2 && text.length <= 120) headings.push(text);
    }
  }

  // Extract tables with depth-counting so nested tables don't confuse boundaries
  const tables: string[][][] = [];
  let pos = 0;
  while (pos < xml.length && tables.length < 12) {
    const tblStart = xml.indexOf("<w:tbl", pos);
    if (tblStart === -1) break;
    let depth = 1, scan = tblStart + 6;
    while (depth > 0 && scan < xml.length) {
      const no = xml.indexOf("<w:tbl", scan);
      const nc = xml.indexOf("</w:tbl>", scan);
      if (nc === -1) { scan = xml.length; break; }
      if (no !== -1 && no < nc) { depth++; scan = no + 6; }
      else { depth--; scan = nc + 8; }
    }
    const tblXml = xml.slice(tblStart, scan);
    const rows: string[][] = [];
    for (const [, trContent] of tblXml.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)) {
      if (rows.length >= 30) break;
      const cells: string[] = [];
      for (const [, tcContent] of trContent.matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)) {
        if (cells.length >= 8) break;
        if (/<w:drawing/.test(tcContent)) {
          cells.push("[IMAGE]");
        } else {
          const text = [...tcContent.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)]
            .map((m) => m[1]).join("").replace(/\s+/g, " ").trim();
          cells.push(text.slice(0, 80));
        }
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length > 0) tables.push(rows);
    pos = scan;
  }

  return { headings, tables };
}

function formatDocStructure(s: DocStructure): string {
  const lines: string[] = [];
  if (s.headings.length > 0) {
    lines.push("TITLE / HEADINGS (text before tables):");
    s.headings.forEach((h) => lines.push(`  "${h}"`));
    lines.push("");
  }
  s.tables.forEach((table, ti) => {
    const cols = Math.max(...table.map((r) => r.length), 0);
    lines.push(`TABLE ${ti + 1} (${table.length} rows × ${cols} cols):`);
    table.forEach((row, ri) => {
      const cells = row.map((c) => (c === "[IMAGE]" ? "[IMAGE]" : c === "" ? "[empty]" : `"${c}"`));
      lines.push(`  Row ${ri + 1}: | ${cells.join(" | ")} |`);
    });
    lines.push("");
  });
  return lines.join("\n");
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

// Portrait → photo or fullphoto (by size), landscape → passport, square → unknown.
// Threshold: portrait slots wider than 4 500 000 EMU (~5 in) are full-body photos.
function classifySlot(s: { cx: number; cy: number }): ImageSlot["purpose"] {
  if (s.cy > s.cx) return s.cx > 4_500_000 ? "fullphoto" : "photo";
  if (s.cx > s.cy) return "passport";
  return "unknown";
}

// Call Claude to analyze the full document structure: map label cells → standard fields
// and identify image placeholder cells by understanding layout, not just a flat word list.
async function analyzeFieldsWithClaude(
  structure: DocStructure,
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
    "ARRIVAL_CITY", "INSURANCE_STATUS", "INSURANCE_DATE", "MEDICAL_DATE",
    "CONTRACT_DATE", "DESTINATION_COUNTRY", "EXPERIENCE_YEARS", "GENDER",
    "MUSANED_STATUS", "PASSPORT_STATUS", "SERIAL_NUMBER", "CANDIDATE_CODE",
    "SKILLS", "SPOKEN_LANGUAGES", "COC_AGENCY_NAME", "EMERGENCY_CONTACT",
  ];

  const systemPrompt = [
    "You are analyzing a recruitment/CV DOCX template for a staff management system.",
    "",
    "You will receive the FULL DOCUMENT LAYOUT — title/headings and each table with its exact rows and columns.",
    "Cells marked [IMAGE] contain an embedded image drawing. Cells marked [empty] have no text.",
    "",
    "UNDERSTAND THE LAYOUT FIRST:",
    "- Tables follow a label→value pattern. Common patterns:",
    "  • 2-col table: | Label | [empty] |  (label in col 0, value slot in col 1)",
    "  • 4-col table: | Label | [empty] | Label | [empty] |  (two key-value pairs per row)",
    "  • A cell spanning the full row width with [IMAGE] is a photo/passport placeholder",
    "- The document title and headings reveal the template's purpose (domestic worker CV, passport page, etc.)",
    "- Identify which tables hold candidate info vs which hold company branding / signatures",
    "",
    "TASK 1 — Field mapping:",
    `Map label cells to one of these standard field names: ${STANDARD.join(", ")}`,
    "",
    "Rules:",
    "- Only map actual label cells (e.g. 'Full Name', 'Date of Birth', 'الاسم') — not value cells or decorators",
    "- Arabic labels are valid — map them if they clearly refer to a standard field",
    "- Skip company names, agency names, section headings, signatures, table borders-only rows",
    "- Religion option words ('Non-Muslim', 'Muslim', 'Christian', 'Non Muslim') and gender words ('Male', 'Female') are VALUE cells, not labels — skip them in fieldMap",
    "- If a cell's text is a religion option word and its adjacent label cell is 'Religion', add it to valueMap instead (e.g. 'Non-Muslim' → RELIGION)",
    "- Use the row/column position to resolve ambiguity (e.g. 'Religion' next to 'Height' helps confirm both)",
    "",
    "TASK 2 — Image cell identification:",
    "Cells containing [IMAGE] or text labels that clearly name a photo/scan slot:",
    "- \"photo\"     → small portrait/passport-size. Examples: PHOTO, Photograph, Pic, 4x4, صورة, صورة شخصية",
    "- \"fullphoto\" → large or full-body photo. Examples: FULL PHOTO, Full Body, Full Length, صورة كاملة",
    "- \"passport\"  → passport bio-page scan. Examples: PASSPORT SCAN, PASSPORT COPY, Bio Page, صورة الجواز",
    "Any photo/picture/صورة word without full/body/whole qualifier → photo. With those qualifiers → fullphoto.",
    "[IMAGE] cells in a table that also contains personal info labels → likely a photo; classify by position (small table cell = photo, large standalone table = fullphoto).",
    "",
    "Return ONLY valid JSON — no explanation, no markdown:",
    '{"fieldMap":{"Label text as it appears in the doc":"STANDARD_FIELD"},"imageCells":[{"label":"exact cell text or [IMAGE]","purpose":"photo"}]}',
  ].join("\n");

  const userPrompt = `Here is the full document layout extracted from the DOCX:\n\n${formatDocStructure(structure)}`;

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
        max_tokens: 2048,
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

    // Ask Claude to analyze the full document layout and map labels to standard fields
    const docStructure = extractDocumentStructure(docXml);
    let fieldMap: Record<string, string> = {};
    let imageCells: ImageCellDef[] = [];
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && (docStructure.tables.length > 0 || docStructure.headings.length > 0)) {
      ({ fieldMap, imageCells } = await analyzeFieldsWithClaude(docStructure, apiKey));
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
