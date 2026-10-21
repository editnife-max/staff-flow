import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptCredential } from "@/lib/credentials-crypto.server";

// ── Chrome / Puppeteer ────────────────────────────────────────────────────────

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT    = 9224; // different port from Wafid checker (9223)
const CHROME_PROFILE = "C:\\temp\\flowpath-chrome-lmis";

// ── LMIS selectors — adjust if the page structure changes ────────────────────
// Login page: https://lmis.gov.et/new-agency/login  (or /accounts/login)
const SEL_LOGIN_USER = "input[name='username'], #id_username, input[type='text']:first-of-type";
const SEL_LOGIN_PASS = "input[name='password'], #id_password, input[type='password']";
const SEL_LOGIN_BTN  = "button[type='submit'], input[type='submit']";

// Placed-labors page: https://lmis.gov.et/new-agency/contract-process/placed-labors
const SEL_SEARCH_INPUT  = "input[name='labour_id'], input[placeholder*='Labour'], input[name='search'], input[type='search'], input[type='text']";
const SEL_SEARCH_BTN    = "button[type='submit'], input[type='submit'], button:contains('Search')";
const SEL_RESULT_ROW    = "table tbody tr:first-child, .result-row:first-child, tr[data-id]:first-child";

// Candidate detail page — medical status and create-contract button
const SEL_MEDICAL_STATUS  = ".medical-status, [data-field='medical_status'], td:contains('Medical'), .field-medical";
const SEL_CREATE_CONTRACT = "a[href*='create-contract'], button:contains('Create Contract'), input[value*='Create Contract'], a:contains('Create Contract')";

const LMIS_BASE_URL          = "https://lmis.gov.et";
const LMIS_LOGIN_URL         = `${LMIS_BASE_URL}/new-agency/login`;
const LMIS_PLACED_LABORS_URL = `${LMIS_BASE_URL}/new-agency/contract-process/placed-labors`;

// ── Helper: launch Chrome with CDP ───────────────────────────────────────────

async function launchChrome() {
  const { spawn } = await import("child_process");
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

  await new Promise<void>((resolve, reject) => {
    proc.on("error", reject);
    const deadline = Date.now() + 15000;
    const poll = async () => {
      if (Date.now() > deadline) { reject(new Error("Chrome CDP timed out after 15s")); return; }
      try {
        const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
        if (r.ok) { resolve(); return; }
      } catch {}
      setTimeout(poll, 500);
    };
    setTimeout(poll, 1000);
  });

  return proc;
}

// ── Main server function ──────────────────────────────────────────────────────

export const runLmisPhase1 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ checked: number; notTested: number; draft: number; errors: number; log: string[] }> => {
    const log: string[] = [];
    const addLog = (msg: string) => { log.push(`[${new Date().toTimeString().slice(0, 8)}] ${msg}`); };

    // 1. Read LMIS credentials
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("lmis_email, lmis_password")
      .eq("id", context.userId)
      .maybeSingle();

    if (!profile) throw new Error("Profile not found");

    const lmisUser = await decryptCredential((profile as any).lmis_email);
    const lmisPass = await decryptCredential((profile as any).lmis_password);

    if (!lmisUser || !lmisPass) {
      throw new Error("LMIS credentials not configured — go to Assignments → LMIS Setup");
    }

    // 2. Fetch processing candidates with labour_id
    const { data: candidates, error: fetchErr } = await supabaseAdmin
      .from("candidates")
      .select("id, full_name, labour_id, lmis_status, lmis_contract_phase")
      .eq("status", "processing")
      .not("labour_id", "is", null)
      .neq("labour_id", "")
      .order("created_at", { ascending: false });

    if (fetchErr) throw new Error(fetchErr.message);

    const toCheck = (candidates ?? []).filter(
      (c) => (c as any).labour_id?.trim()
    );

    if (toCheck.length === 0) {
      return { checked: 0, notTested: 0, draft: 0, errors: 0, log: ["No processing candidates with a labour ID found."] };
    }

    addLog(`Found ${toCheck.length} candidates to check`);

    // 3. Launch Chrome
    addLog("Launching Chrome…");
    const chromeProc = await launchChrome();
    addLog(`Chrome running on CDP port ${CDP_PORT}`);

    let checked = 0, notTested = 0, draft = 0, errors = 0;

    try {
      const puppeteer = (await import("puppeteer-core")).default;
      const browser = await puppeteer.connect({
        browserURL: `http://127.0.0.1:${CDP_PORT}`,
        defaultViewport: { width: 1280, height: 900 },
      });

      // 4. Login to LMIS
      addLog("Logging in to lmis.gov.et…");
      const loginPage = await browser.newPage();
      await loginPage.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      );
      await loginPage.goto(LMIS_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

      // Fill credentials
      await loginPage.waitForSelector(SEL_LOGIN_USER, { timeout: 10000 });
      await loginPage.$eval(SEL_LOGIN_USER, (el: Element) => { (el as HTMLInputElement).value = ""; });
      await loginPage.type(SEL_LOGIN_USER, lmisUser, { delay: 40 });
      await loginPage.$eval(SEL_LOGIN_PASS, (el: Element) => { (el as HTMLInputElement).value = ""; });
      await loginPage.type(SEL_LOGIN_PASS, lmisPass, { delay: 40 });
      await loginPage.click(SEL_LOGIN_BTN);
      await loginPage.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1500));

      const afterLoginUrl = loginPage.url();
      if (afterLoginUrl.includes("login") || afterLoginUrl.includes("signin")) {
        addLog("ERROR: Login failed — check LMIS credentials in Assignments");
        await browser.disconnect();
        throw new Error("LMIS login failed — invalid credentials");
      }
      addLog("Login successful");
      await loginPage.close();

      // 5. Process each candidate
      for (const candidate of toCheck) {
        const labourId = (candidate as any).labour_id.trim();
        addLog(`Checking: ${candidate.full_name} (${labourId})`);

        try {
          const page = await browser.newPage();
          await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
          );

          // Navigate to placed-labors
          await page.goto(LMIS_PLACED_LABORS_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
          await new Promise((r) => setTimeout(r, 1000));

          // Search by labour_id
          await page.waitForSelector(SEL_SEARCH_INPUT, { timeout: 8000 });
          await page.$eval(SEL_SEARCH_INPUT, (el: Element) => { (el as HTMLInputElement).value = ""; });
          await page.type(SEL_SEARCH_INPUT, labourId, { delay: 40 });
          await page.click(SEL_SEARCH_BTN);
          await new Promise((r) => setTimeout(r, 2000));

          // Click first result row
          const resultEl = await page.$(SEL_RESULT_ROW);
          if (!resultEl) {
            addLog(`  → Not found on LMIS (no result row)`);
            errors++;
            await page.close();
            continue;
          }
          await resultEl.click();
          await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 1500));

          // Read Medical Status from detail page
          const pageHtml = await page.content();
          const medStatusEl = await page.$(SEL_MEDICAL_STATUS);
          const medStatusText = medStatusEl
            ? await page.evaluate((el: Element) => el.textContent ?? "", medStatusEl)
            : "";

          const medLower = (medStatusText + pageHtml).toLowerCase();
          const isApproved  = /approved/i.test(medStatusText) || /medical.*approved/i.test(pageHtml);
          const isNotTested = /not\s*tested/i.test(medStatusText) || /medical.*not\s*tested/i.test(pageHtml);

          if (isNotTested) {
            addLog(`  → Medical: Not tested — updating lmis_status`);
            await supabaseAdmin
              .from("candidates")
              .update({ lmis_status: "Not tested" } as any)
              .eq("id", candidate.id);
            notTested++;
            checked++;
          } else if (isApproved) {
            addLog(`  → Medical: Approved — creating contract on LMIS`);

            // Click "Create Contract" button/link
            const contractBtn = await page.$(SEL_CREATE_CONTRACT);
            if (contractBtn) {
              await contractBtn.click();
              await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
              await new Promise((r) => setTimeout(r, 2000));

              // Check if it succeeded (look for success indicators)
              const afterHtml = await page.content();
              const success = /success|contract.*created|draft/i.test(afterHtml);

              if (success) {
                addLog(`  → Contract created — moving to Draft (Phase 2)`);
                await supabaseAdmin
                  .from("candidates")
                  .update({ lmis_contract_phase: "draft" } as any)
                  .eq("id", candidate.id);
                draft++;
              } else {
                addLog(`  → Create Contract clicked but result unclear — marked as Phase 1`);
                const p1Start = new Date().toISOString().split("T")[0];
                const p1End = new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split("T")[0];
                await supabaseAdmin
                  .from("candidates")
                  .update({ lmis_contract_phase: "create", musaned_contract_start: p1Start, musaned_contract_end: p1End } as any)
                  .eq("id", candidate.id);
              }
            } else {
              addLog(`  → Approved but no Create Contract button found — marked as Phase 1`);
              const p1Start = new Date().toISOString().split("T")[0];
              const p1End = new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split("T")[0];
              await supabaseAdmin
                .from("candidates")
                .update({ lmis_contract_phase: "create", musaned_contract_start: p1Start, musaned_contract_end: p1End } as any)
                .eq("id", candidate.id);
            }
            checked++;
          } else {
            addLog(`  → Medical status: "${medStatusText.trim() || "unknown"}" — no action`);
            checked++;
          }

          await page.close();
          // Small delay between candidates to avoid rate limiting
          await new Promise((r) => setTimeout(r, 800));
        } catch (err: any) {
          addLog(`  → ERROR: ${err.message}`);
          errors++;
        }
      }

      await browser.disconnect();
    } finally {
      try { chromeProc.kill(); } catch {}
    }

    addLog(`Done — checked ${checked}, not-tested ${notTested}, moved to draft ${draft}, errors ${errors}`);
    return { checked, notTested, draft, errors, log };
  });
