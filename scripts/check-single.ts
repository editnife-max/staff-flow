/**
 * Single-candidate Wafid medical check.
 * Usage: bun scripts/check-single.ts <PASSPORT> <NATIONALITY_VALUE>
 * Outputs a single JSON line to stdout: { status, date, message }
 * All other output goes to stderr.
 */

import puppeteer from "puppeteer-core";
import { spawn } from "child_process";

const passport = (process.argv[2] ?? "").trim().toUpperCase();
const nationality = process.argv[3] ?? "60";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9224; // separate port from the batch checker (9223)
const CHROME_PROFILE = "C:\\temp\\flowpath-chrome-single";
const WAFID_URL = "https://wafid.com/en/medical-status-search/";

function err(msg: string) { process.stderr.write(msg + "\n"); }

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

async function main() {
  if (!passport) {
    process.stdout.write(JSON.stringify({ status: null, date: null, message: "No passport provided" }) + "\n");
    return;
  }

  err(`Checking passport: ${passport} (nationality: ${nationality})`);

  const chromeProc = await launchChrome();
  err("Chrome started");

  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${CDP_PORT}`,
    defaultViewport: { width: 1280, height: 800 },
  });

  let status: string | null = null;
  let date: string | null = null;
  let message = "";

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    );

    await page.goto(WAFID_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.$eval("#id_search_variant_0", (el) => (el as HTMLInputElement).click());
    await page.focus("#id_passport");
    await page.keyboard.type(passport, { delay: 40 });
    await page.select("#id_nationality", nationality);

    // Wait for reCAPTCHA v3 to auto-execute
    await new Promise(r => setTimeout(r, 3000));

    await page.click("#med-status-form-submit");
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    const html = await page.content();

    if (html.includes("medical-status-modal-acceptance") || />\s*fit\s*</i.test(html)) {
      status = "Fit";
      try {
        const dateText = await page.$$eval(
          ".medical-status-table .field_value",
          (els) => els.map((e) => e.textContent ?? "").join(" ")
        );
        const m = dateText.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/);
        if (m) {
          const parts = m[0].split(/[\/\-]/).map((p) => p.padStart(2, "0"));
          date = parts[2].length === 4
            ? `${parts[2]}-${parts[1]}-${parts[0]}`
            : m[0];
        }
      } catch {}
    } else if (html.includes("medical-status-modal-rejection") || />\s*unfit\s*</i.test(html)) {
      status = "Unfit";
    } else if (html.includes("medical-status-modal-normal") || />\s*retest\s*</i.test(html)) {
      status = "Retest";
    } else if (/no record|not found|invalid passport/i.test(html)) {
      message = "No record on Wafid";
    } else {
      message = "Could not determine status";
    }

    await page.close();
  } finally {
    await browser.disconnect().catch(() => {});
    try { chromeProc.kill(); } catch {}
  }

  err(`Result: status=${status ?? "null"} date=${date ?? "null"}`);
  process.stdout.write(
    JSON.stringify({ status, date, message: message || (status ? `${status}${date ? ` · ${date}` : ""}` : "") }) + "\n"
  );
}

main().catch((e) => {
  process.stderr.write(String(e) + "\n");
  process.stdout.write(JSON.stringify({ status: null, date: null, message: `Error: ${String(e)}` }) + "\n");
  process.exit(0);
});
