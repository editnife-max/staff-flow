/**
 * Automated Wafid Medical Status Checker
 *
 * Checks medical fitness status for candidates in Available/Processing tabs on wafid.com
 * and updates the `medical_status` field in Supabase.
 *
 * Run manually: bun run check-medical
 * Scheduled:    Windows Task Scheduler (see scripts/setup-medical-scheduler.ps1)
 *               7:00 AM and 2:00 PM daily
 */

import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const WAFID_URL = "https://wafid.com/en/medical-status-search/";
const ETHIOPIAN_NATIONALITY_VALUE = "60";

// Nationality code map for supported countries (add more as needed)
const NATIONALITY_CODES: Record<string, string> = {
  ethiop: "60",
  ghana: "72",
  kenya: "106",
  uganda: "214",
  nigeria: "154",
  tanzania: "202",
  rwanda: "177",
  somalia: "191",
  eritrea: "58",
  sudan: "196",
  egypt: "56",
  philippines: "166",
  indonesia: "89",
  india: "88",
  bangladesh: "18",
  pakistan: "161",
  srilanka: "196",
};

// Chrome 123 is installed and works with --remote-debugging-port
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9223; // use a non-standard port to avoid conflicts
const CHROME_PROFILE = "C:\\temp\\flowpath-chrome-medical";

// Log file — placed in project root logs/ directory
const LOG_FILE = path.join(
  path.dirname(path.dirname(new URL(import.meta.url).pathname.slice(1))),
  "logs",
  "medical-check.log"
);

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch {}
}

// ─── Browser helpers ──────────────────────────────────────────────────────────

function launchChrome(): Promise<ReturnType<typeof spawn>> {
  return new Promise((resolve, reject) => {
    const proc = spawn(CHROME_PATH, [
      `--remote-debugging-port=${CDP_PORT}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-translate",
      "--disable-dev-shm-usage",
      "--headless=new",
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      `--user-data-dir=${CHROME_PROFILE}`,
    ], { detached: false });

    proc.on("error", reject);

    // Poll until CDP is ready
    const deadline = Date.now() + 15000;
    const poll = async () => {
      if (Date.now() > deadline) { reject(new Error("Chrome CDP timed out")); return; }
      try {
        const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
        if (r.ok) { resolve(proc); return; }
      } catch {}
      setTimeout(poll, 500);
    };
    setTimeout(poll, 1000);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    log("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Fetch candidates in Available/Processing tabs — all medical statuses:
  //   "No"          → not yet checked on wafid
  //   "Booked"      → medical appointment booked, check if result is available
  //   "Expired"     → was Fit but window passed; re-confirm on wafid
  //   "In progress" → medical process ongoing
  //   "Fit"         → re-confirm to catch expiry
  //   "Unfit"/"Retest" → check if status changed
  //   null          → never checked
  const { data: candidates, error } = await supabase
    .from("candidates")
    .select("id, full_name, passport_number, medical_status, country, status")
    .in("status", ["available", "processing"])
    .not("passport_number", "is", null)
    .neq("passport_number", "")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    log(`ERROR fetching candidates: ${error.message}`);
    process.exit(1);
  }

  const toCheck = (candidates ?? []).filter(
    (c) => c.passport_number && c.passport_number.trim() !== ""
  );

  const tabCounts = toCheck.reduce<Record<string, number>>((acc, c) => {
    const k = c.status ?? "none";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const medCounts = toCheck.reduce<Record<string, number>>((acc, c) => {
    const k = c.medical_status ?? "none";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  log(
    `Checking ${toCheck.length} candidates ` +
    `[tabs: ${Object.entries(tabCounts).map(([k, v]) => `${k}×${v}`).join(", ")}] ` +
    `[medical: ${Object.entries(medCounts).map(([k, v]) => `${k}×${v}`).join(", ")}]`
  );

  if (toCheck.length === 0) {
    log("Nothing to check. Exiting.");
    return;
  }

  log("Launching Chrome...");
  const chromeProc = await launchChrome();
  log(`Chrome started on port ${CDP_PORT}`);

  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${CDP_PORT}`,
    defaultViewport: { width: 1280, height: 800 },
  });

  let updated = 0;
  let failed = 0;
  let unchanged = 0;

  for (const candidate of toCheck) {
    const passport = candidate.passport_number!.trim().toUpperCase();
    log(`Checking: ${candidate.full_name} (${passport})`);

    try {
      const page = await browser.newPage();

      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
      );

      // Use domcontentloaded (not networkidle0) — wafid has persistent analytics traffic
      await page.goto(WAFID_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

      // Select "By Passport Number" radio
      await page.$eval("#id_search_variant_0", (el: Element) => (el as HTMLInputElement).click());

      // Fill passport number
      await page.focus("#id_passport");
      await page.keyboard.type(passport, { delay: 40 });

      // Resolve nationality code from candidate's country field
      const countryKey = (candidate.country ?? "").toLowerCase().replace(/\s+/g, "");
      let nationalityCode = ETHIOPIAN_NATIONALITY_VALUE; // default to Ethiopian
      for (const [key, code] of Object.entries(NATIONALITY_CODES)) {
        if (countryKey.includes(key)) { nationalityCode = code; break; }
      }
      await page.select("#id_nationality", nationalityCode);

      // Wait for reCAPTCHA v3 to auto-execute in background
      await new Promise((r) => setTimeout(r, 3000));

      // Submit
      await page.click("#med-status-form-submit");
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 2000));

      const pageContent = await page.content();

      let medicalStatus: string | null = null;
      let examDate: string | null = null;

      if (
        pageContent.includes("medical-status-modal-acceptance") ||
        />\s*fit\s*</i.test(pageContent)
      ) {
        medicalStatus = "Fit";
      } else if (
        pageContent.includes("medical-status-modal-rejection") ||
        />\s*unfit\s*</i.test(pageContent)
      ) {
        medicalStatus = "Unfit";
      } else if (
        pageContent.includes("medical-status-modal-normal") ||
        />\s*retest\s*</i.test(pageContent)
      ) {
        medicalStatus = "Retest";
      } else if (/no medical report found|no active appointment found|no[- ]record|not found|invalid passport/i.test(pageContent)) {
        medicalStatus = "No";
      }

      // Extract examination date for Fit results
      if (medicalStatus === "Fit") {
        try {
          examDate = await page.evaluate(() => {
            const DATE_RE = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/;
            const labels = Array.from(document.querySelectorAll(".medical-status-table .field_name"));
            for (const label of labels) {
              if (/medical\s+examination\s+date/i.test(label.textContent ?? "")) {
                const valueEl = label.closest("tr")?.querySelector(".field_value")
                  ?? label.nextElementSibling;
                const text = valueEl?.textContent ?? "";
                const m = text.match(DATE_RE);
                if (m) {
                  const parts = m[0].split(/[\/\-]/).map((p: string) => p.padStart(2, "0"));
                  return parts[2].length === 4
                    ? `${parts[2]}-${parts[1]}-${parts[0]}`
                    : m[0];
                }
              }
            }
            // Fallback: find date closest to current year
            const currentYear = new Date().getFullYear();
            const allValues = Array.from(document.querySelectorAll(".medical-status-table .field_value"))
              .map((el) => el.textContent ?? "").join(" ");
            const DATE_RE_G = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/g;
            const dates = [...allValues.matchAll(DATE_RE_G)].map((m) => m[0]);
            const recent = dates.find((d) => {
              const parts = d.split(/[\/\-]/);
              const yr = parseInt(parts.find((p: string) => p.length === 4) ?? "0");
              return yr >= currentYear - 1 && yr <= currentYear + 1;
            });
            if (recent) {
              const parts = recent.split(/[\/\-]/).map((p: string) => p.padStart(2, "0"));
              return parts[2].length === 4 ? `${parts[2]}-${parts[1]}-${parts[0]}` : recent;
            }
            return null;
          });
        } catch {}
      }

      await page.close();

      if (medicalStatus === null) {
        unchanged++;
        continue;
      }

      log(`  → Status: ${medicalStatus}${examDate ? ` (${examDate})` : ""}`);

      // Skip update if status unchanged (except Fit/Expired always refresh the date)
      if (medicalStatus !== "Fit" && candidate.medical_status !== "Expired" && candidate.medical_status === medicalStatus) {
        unchanged++;
        continue;
      }

      const today = new Date().toISOString().split("T")[0];
      const { error: updateError } = await supabase
        .from("candidates")
        .update({
          medical_status: medicalStatus,
          medical_date: medicalStatus === "No" ? null : (examDate ?? today),
        })
        .eq("id", candidate.id);

      if (updateError) {
        log(`  ERROR updating ${candidate.full_name}: ${updateError.message}`);
        failed++;
      } else {
        log(`  ✓ Updated ${candidate.full_name} → ${medicalStatus}${examDate ? ` (${examDate})` : ""}`);
        updated++;
      }

      await new Promise((r) => setTimeout(r, 3000));
    } catch (err) {
      log(`  ERROR for ${candidate.full_name} (${passport}): ${String(err)}`);
      failed++;
    }
  }

  await browser.disconnect();
  chromeProc.kill();

  log(
    `Done. Updated: ${updated}, Unchanged: ${unchanged}, Failed: ${failed} out of ${toCheck.length} candidates`
  );
}

main().catch((err) => {
  log(`FATAL: ${String(err)}`);
  process.exit(1);
});
