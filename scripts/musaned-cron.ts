/**
 * Musaned daily fetch — run at 6:00 PM (Ethiopia time) via Windows Task Scheduler:
 *
 *   Program:  C:\Users\<you>\.bun\bin\bun.exe
 *   Arguments: run scripts/musaned-cron.ts
 *   Start in:  C:\Project\flowpath-suite
 *   Trigger:   Daily at 18:00
 *
 * Requires .env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import { createDecipheriv, createHash } from "crypto";

// ── Env ───────────────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.SUPABASE_URL!;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ENCRYPT_KEY   = process.env.CREDENTIAL_ENCRYPT_KEY ?? "flowpath-default-key-32-bytes!!";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Credential decryption (mirrors credentials-crypto.server.ts) ──────────────

function decryptCredential(encrypted: string | null | undefined): string {
  if (!encrypted) return "";
  try {
    const buf  = Buffer.from(encrypted, "base64");
    const iv   = buf.subarray(0, 16);
    const data = buf.subarray(16);
    const key  = createHash("sha256").update(ENCRYPT_KEY).digest();
    const dec  = createDecipheriv("aes-256-cbc", key, iv);
    return Buffer.concat([dec.update(data), dec.final()]).toString("utf8");
  } catch {
    return encrypted; // return as-is if not encrypted
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[musaned-cron] Starting at ${new Date().toISOString()}`);

  // 1. Get manager profile with Musaned credentials
  // Uses first profile that has musaned credentials (single-manager setup)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, musaned_email, musaned_password")
    .not("musaned_email", "is", null)
    .limit(1);

  const profile = profiles?.[0];
  if (!profile) {
    console.error("[musaned-cron] No profile with Musaned credentials found — configure in Assignments → Musaned Setup");
    process.exit(1);
  }

  const musanedUser = decryptCredential((profile as any).musaned_email);
  const musanedPass = decryptCredential((profile as any).musaned_password);

  if (!musanedUser || !musanedPass) {
    console.error("[musaned-cron] Musaned credentials are empty after decryption");
    process.exit(1);
  }

  // 2. Get Processing candidates with no Musaned data yet
  const { data: candidates, error } = await supabase
    .from("candidates")
    .select("id, full_name, passport_number")
    .eq("status", "processing")
    .not("passport_number", "is", null)
    .neq("passport_number", "")
    .is("musaned_fetched_at", null)
    .order("created_at", { ascending: false });

  if (error) { console.error("[musaned-cron] DB error:", error.message); process.exit(1); }
  if (!candidates?.length) { console.log("[musaned-cron] No new Processing candidates — nothing to do."); process.exit(0); }

  console.log(`[musaned-cron] ${candidates.length} candidates to fetch`);

  // 3. Import and run the core scraper
  // Dynamic import to avoid loading TanStack Start context at module level
  const { runMusanedFetchCore } = await import("../src/lib/musaned.functions.ts");

  const result = await runMusanedFetchCore({
    musanedUser,
    musanedPass,
    candidates: candidates as any,
    onLog: (msg) => console.log(msg),
  });

  console.log(`[musaned-cron] Done — fetched=${result.fetched} skipped=${result.skipped} errors=${result.errors}`);
  process.exit(result.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[musaned-cron] Fatal:", err.message);
  process.exit(1);
});
