import { parse } from "node-html-parser";

const WAFID_NATIONALITY: Array<[string, string]> = [
  ["ethiop", "60"],
  ["philippin", "177"],
  ["filipin", "177"],
  ["sri lanka", "156"],
  ["indonesia", "81"],
  ["bangladesh", "15"],
  ["kenya", "92"],
  ["uganda", "166"],
  ["india", "1"],
  ["nepal", "125"],
  ["ghana", "69"],
];

export function wafidNationality(country: string | null): string {
  const lc = (country ?? "").toLowerCase();
  for (const [key, val] of WAFID_NATIONALITY) {
    if (lc.includes(key)) return val;
  }
  return "60";
}

export interface WafidResult {
  status: string | null;
  date: string | null;
  message: string;
}

const WAFID_URL = "https://wafid.com/en/medical-status-search/";
const RECAPTCHA_SITE_KEY = "6LflPAwnAAAAAL2wBGi6tSyGUyj-xFvftINOR9xp";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const DATE_RE = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/;

function normaliseDate(raw: string): string {
  const parts = raw.split(/[\/\-]/).map((p) => p.padStart(2, "0"));
  return parts[2]?.length === 4
    ? `${parts[2]}-${parts[1]}-${parts[0]}`
    : raw;
}

function extractCsrf(html: string): string | null {
  const doc = parse(html);
  const input = doc.querySelector("input[name=csrfmiddlewaretoken]");
  return input?.getAttribute("value") ?? null;
}

function extractExamDate(doc: ReturnType<typeof parse>): string | null {
  // Strategy 1: field_name / field_value paired <td> or <th> inside same <tr>
  for (const row of doc.querySelectorAll("tr")) {
    const nameEl = row.querySelector("[class*=field_name]");
    if (!nameEl) continue;
    if (!/examination\s*date/i.test(nameEl.text)) continue;
    const valEl = row.querySelector("[class*=field_value]");
    if (!valEl) continue;
    const m = valEl.text.trim().match(DATE_RE);
    if (m) return normaliseDate(m[0]);
  }

  // Strategy 2: plain-text scan around "examination date" label
  const plain = doc.text.replace(/\s+/g, " ");
  const idx = plain.search(/examination\s*date\s*:?/i);
  if (idx !== -1) {
    const m = plain.slice(idx, idx + 80).match(DATE_RE);
    if (m) return normaliseDate(m[0]);
  }

  // Strategy 3: year-range heuristic — pick any date in ±1 year window
  const currentYear = new Date().getFullYear();
  const allDates = [...plain.matchAll(new RegExp(DATE_RE.source, "g"))].map((m) => m[0]);
  const candidate = allDates.find((d) => {
    const parts = d.split(/[\/\-]/);
    const yr = parseInt(parts.find((p) => p.length === 4) ?? "0");
    return yr >= currentYear - 1 && yr <= currentYear + 1;
  });
  return candidate ? normaliseDate(candidate) : null;
}

export async function checkWafidForCandidate(
  passport: string,
  nationality: string,
): Promise<WafidResult> {
  const TWOCAPTCHA_KEY = process.env.TWOCAPTCHA_API_KEY;
  if (!TWOCAPTCHA_KEY) {
    return { status: null, date: null, message: "TWOCAPTCHA_API_KEY env var not set" };
  }

  // Step 1: GET wafid page for CSRF token + session cookie
  let pageHtml: string;
  let cookieStr: string;
  try {
    const getRes = await fetch(WAFID_URL, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!getRes.ok) {
      return { status: null, date: null, message: `wafid.com unreachable (HTTP ${getRes.status})` };
    }
    pageHtml = await getRes.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawCookies: string[] = typeof (getRes.headers as any).getSetCookie === "function"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (getRes.headers as any).getSetCookie()
      : [getRes.headers.get("set-cookie") ?? ""];
    cookieStr = rawCookies.map((h) => h.split(";")[0].trim()).filter(Boolean).join("; ");
  } catch (e) {
    return { status: null, date: null, message: `Network error reaching wafid.com: ${e}` };
  }

  const csrf = extractCsrf(pageHtml);
  if (!csrf) {
    return { status: null, date: null, message: "Could not read CSRF token from wafid.com" };
  }

  // Step 2: Solve reCAPTCHA v3 via 2captcha
  let recaptchaToken: string | null = null;
  try {
    const submitRes = await fetch("https://api.2captcha.com/createTask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientKey: TWOCAPTCHA_KEY,
        task: {
          type: "RecaptchaV3TaskProxyless",
          websiteURL: WAFID_URL,
          websiteKey: RECAPTCHA_SITE_KEY,
          minScore: 0.1,
          pageAction: "form",
        },
      }),
    });
    const submitData = await submitRes.json() as { errorId: number; errorCode?: string; taskId?: number };
    if (submitData.errorId !== 0) throw new Error(submitData.errorCode ?? "createTask failed");
    const taskId = submitData.taskId!;

    for (let i = 0; i < 18; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const pollRes = await fetch("https://api.2captcha.com/getTaskResult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientKey: TWOCAPTCHA_KEY, taskId }),
      });
      const pollData = await pollRes.json() as {
        errorId: number; errorCode?: string;
        status: string; solution?: { gRecaptchaResponse: string };
      };
      if (pollData.errorId !== 0) throw new Error(pollData.errorCode ?? "getTaskResult failed");
      if (pollData.status === "ready") { recaptchaToken = pollData.solution!.gRecaptchaResponse; break; }
    }
  } catch (e) {
    return { status: null, date: null, message: `reCAPTCHA solve failed: ${e}` };
  }

  if (!recaptchaToken) {
    return { status: null, date: null, message: "reCAPTCHA solve timed out" };
  }

  // Step 3: POST the search form
  const formBody = new URLSearchParams({
    csrfmiddlewaretoken: csrf,
    search_variant: "passport",
    passport,
    nationality,
    captcha: recaptchaToken,
  });

  let resultHtml: string;
  try {
    const postRes = await fetch(WAFID_URL, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": WAFID_URL,
        "Origin": "https://wafid.com",
        "Cookie": cookieStr,
        "X-CSRFToken": csrf,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      body: formBody.toString(),
    });
    resultHtml = await postRes.text();
  } catch (e) {
    return { status: null, date: null, message: `POST to wafid.com failed: ${e}` };
  }

  // Step 4: Parse result HTML with proper parser
  const doc = parse(resultHtml);
  const bodyText = doc.text;

  let status: string | null = null;
  let date: string | null = null;
  let message = "";

  if (
    doc.getElementById("medical-status-modal-acceptance") ||
    />\s*fit\s*</i.test(resultHtml)
  ) {
    status = "Fit";
    date = extractExamDate(doc);
  } else if (
    doc.getElementById("medical-status-modal-rejection") ||
    />\s*unfit\s*</i.test(resultHtml)
  ) {
    status = "Unfit";
  } else if (
    /in[\s-]*progress/i.test(
      doc.querySelector(".status")?.text ?? bodyText.slice(0, 2000),
    )
  ) {
    status = "In progress";
  } else if (
    doc.getElementById("medical-status-modal-normal") ||
    />\s*retest\s*</i.test(resultHtml)
  ) {
    status = "Retest";
  } else if (
    /no medical report found|no active appointment found|no[- ]record|not found|invalid passport/i.test(
      bodyText,
    )
  ) {
    status = "No";
    message = "No record on Wafid";
  } else if (/error verifying recaptcha/i.test(bodyText)) {
    message = "reCAPTCHA verification failed";
  } else {
    message = `Could not determine status. Response: ${bodyText.replace(/\s+/g, " ").trim().slice(0, 300)}`;
  }

  return {
    status,
    date,
    message: message || (status ? `${status}${date ? ` · ${date}` : ""}` : "No result"),
  };
}
