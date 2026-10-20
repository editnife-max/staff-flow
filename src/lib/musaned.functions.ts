import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptCredential } from "@/lib/credentials-crypto.server";

// ── Chrome / Puppeteer ────────────────────────────────────────────────────────

const CHROME_PATH    = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT       = 9226; // unique port — different from LMIS (9224) and Wafid (9223)
const CHROME_PROFILE = "C:\\temp\\flowpath-chrome-musaned";

// ── Musaned selectors ─────────────────────────────────────────────────────────
// Adjust these if the page structure changes after a site update.
//
// Login page: https://musaned.com.sa  (redirects to login if not authenticated)
const SEL_LOGIN_USER  = "input[name='username'], input[name='email'], input[type='email'], #username, #email";
const SEL_LOGIN_PASS  = "input[name='password'], input[type='password'], #password";
const SEL_LOGIN_BTN   = "button[type='submit'], input[type='submit'], button:contains('Login'), button:contains('تسجيل')";

// Worker search — after login, navigate to worker/contract lookup
// Musaned search page is typically reached via the dashboard "Worker Detail" section
const MUSANED_BASE_URL   = "https://musaned.com.sa";
const MUSANED_LOGIN_URL  = `${MUSANED_BASE_URL}/auth/login`;
// After login the search page for domestic worker details is typically:
const MUSANED_SEARCH_URL = `${MUSANED_BASE_URL}/ContractOffer/ContractDetails`;

// Passport search input on the search/lookup page
const SEL_PASSPORT_INPUT = "input[name='passportNumber'], input[placeholder*='Passport'], input[placeholder*='جواز'], input[name='passport'], input[id*='passport']";
const SEL_SEARCH_BTN     = "button[type='submit'], input[type='submit'], button:contains('Search'), button:contains('بحث')";

// Fields to extract from the worker detail / contract page
// These selectors target the text nodes next to each label
const SEL_VISA_NUMBER      = "[data-field='visaNumber'], .visa-number, td:contains('Visa') + td, [id*='visaNumber'], [id*='visa_number']";
const SEL_EMPLOYER_CITY    = "[data-field='employerCity'], .employer-city, td:contains('City') + td, td:contains('مدينة') + td, [id*='city']";
const SEL_EMPLOYER_NAME    = "[data-field='employerName'], .employer-name, td:contains('Employer Name') + td, td:contains('صاحب') + td, [id*='employerName']";
const SEL_EMPLOYER_PHONE   = "[data-field='employerPhone'], .employer-phone, td:contains('Phone') + td, td:contains('هاتف') + td, [id*='phone']";
const SEL_HOUSE_NUMBER     = "[data-field='houseNumber'], .house-number, td:contains('House') + td, td:contains('رقم المنزل') + td, [id*='house']";

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

// ── Helper: extract text from a selector, return null if not found ────────────

async function extractText(page: any, selector: string): Promise<string | null> {
  try {
    const el = await page.$(selector);
    if (!el) return null;
    const text = await page.evaluate((e: Element) => e.textContent?.trim() ?? "", el);
    return text || null;
  } catch {
    return null;
  }
}

// ── Core scraper logic (shared between server fn and cron script) ─────────────

export async function runMusanedFetchCore(opts: {
  musanedUser: string;
  musanedPass: string;
  candidates: Array<{ id: string; full_name: string; passport_number: string }>;
  onLog: (msg: string) => void;
}): Promise<{ fetched: number; skipped: number; errors: number; log: string[] }> {
  const { musanedUser, musanedPass, candidates, onLog } = opts;
  const log: string[] = [];
  const addLog = (msg: string) => { const line = `[${new Date().toTimeString().slice(0, 8)}] ${msg}`; log.push(line); onLog(line); };

  let fetched = 0, skipped = 0, errors = 0;

  if (!candidates.length) {
    addLog("No new Processing candidates to fetch.");
    return { fetched, skipped, errors, log };
  }

  addLog(`Found ${candidates.length} candidates to fetch from Musaned`);
  addLog("Launching Chrome…");
  const chromeProc = await launchChrome();
  addLog(`Chrome running on CDP port ${CDP_PORT}`);

  try {
    const puppeteer = (await import("puppeteer-core")).default;
    const browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${CDP_PORT}`,
      defaultViewport: { width: 1280, height: 900 },
    });

    // Login
    addLog("Logging in to musaned.com.sa…");
    const loginPage = await browser.newPage();
    await loginPage.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    await loginPage.goto(MUSANED_BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));

    // If redirected to login page, fill credentials
    const currentUrl = loginPage.url();
    if (currentUrl.includes("login") || currentUrl.includes("auth") || currentUrl === MUSANED_BASE_URL + "/") {
      await loginPage.waitForSelector(SEL_LOGIN_USER, { timeout: 10000 });
      await loginPage.$eval(SEL_LOGIN_USER, (el: Element) => { (el as HTMLInputElement).value = ""; });
      await loginPage.type(SEL_LOGIN_USER, musanedUser, { delay: 50 });
      await loginPage.$eval(SEL_LOGIN_PASS, (el: Element) => { (el as HTMLInputElement).value = ""; });
      await loginPage.type(SEL_LOGIN_PASS, musanedPass, { delay: 50 });
      await loginPage.click(SEL_LOGIN_BTN);
      await loginPage.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 2000));
    }

    const afterLoginUrl = loginPage.url();
    if (afterLoginUrl.includes("login") || afterLoginUrl.includes("auth/login")) {
      addLog("ERROR: Login failed — check Musaned credentials in Assignments");
      await browser.disconnect();
      throw new Error("Musaned login failed — invalid credentials");
    }
    addLog("Login successful");
    await loginPage.close();

    // Process each candidate
    for (const candidate of candidates) {
      const passport = candidate.passport_number.trim().toUpperCase();
      addLog(`Fetching: ${candidate.full_name} (${passport})`);

      try {
        const page = await browser.newPage();
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        );

        // Navigate to search/contract details page
        await page.goto(MUSANED_SEARCH_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
        await new Promise((r) => setTimeout(r, 1000));

        // Search by passport number
        await page.waitForSelector(SEL_PASSPORT_INPUT, { timeout: 8000 });
        await page.$eval(SEL_PASSPORT_INPUT, (el: Element) => { (el as HTMLInputElement).value = ""; });
        await page.type(SEL_PASSPORT_INPUT, passport, { delay: 50 });
        await page.click(SEL_SEARCH_BTN);
        await new Promise((r) => setTimeout(r, 2500));

        // Extract the 5 fields
        const visaNumber    = await extractText(page, SEL_VISA_NUMBER);
        const employerCity  = await extractText(page, SEL_EMPLOYER_CITY);
        const employerName  = await extractText(page, SEL_EMPLOYER_NAME);
        const employerPhone = await extractText(page, SEL_EMPLOYER_PHONE);
        const houseNumber   = await extractText(page, SEL_HOUSE_NUMBER);

        if (!visaNumber && !employerName && !employerCity) {
          addLog(`  → No data found for ${passport} — skipping`);
          skipped++;
          await page.close();
          continue;
        }

        // Save to DB
        await supabaseAdmin
          .from("candidates")
          .update({
            musaned_visa_number:   visaNumber,
            musaned_employer_city: employerCity,
            musaned_employer_name: employerName,
            musaned_employer_phone: employerPhone,
            musaned_house_number:  houseNumber,
            musaned_fetched_at:    new Date().toISOString(),
          } as any)
          .eq("id", candidate.id);

        addLog(`  → Saved: Visa=${visaNumber ?? "—"}, City=${employerCity ?? "—"}, Employer=${employerName ?? "—"}`);
        fetched++;
        await page.close();
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

  addLog(`Done — fetched ${fetched}, skipped ${skipped}, errors ${errors}`);
  return { fetched, skipped, errors, log };
}

// ── Server function (manual trigger from UI) ──────────────────────────────────

export const runMusanedFetch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ fetched: number; skipped: number; errors: number; log: string[] }> => {
    // Read Musaned credentials
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("musaned_email, musaned_password")
      .eq("id", context.userId)
      .maybeSingle();

    if (!profile) throw new Error("Profile not found");

    const musanedUser = await decryptCredential((profile as any).musaned_email);
    const musanedPass = await decryptCredential((profile as any).musaned_password);

    if (!musanedUser || !musanedPass) {
      throw new Error("Musaned credentials not configured — go to Assignments → Musaned Setup");
    }

    // Only fetch candidates not yet fetched (musaned_fetched_at IS NULL)
    const { data: candidates, error } = await supabaseAdmin
      .from("candidates")
      .select("id, full_name, passport_number")
      .eq("status", "processing")
      .not("passport_number", "is", null)
      .neq("passport_number", "")
      .is("musaned_fetched_at", null)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return runMusanedFetchCore({
      musanedUser,
      musanedPass,
      candidates: (candidates ?? []) as any,
      onLog: () => {},
    });
  });
