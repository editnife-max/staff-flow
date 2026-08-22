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
    cookieStr = rawCookies.map(h => h.split(";")[0].trim()).filter(Boolean).join("; ");
  } catch (e) {
    return { status: null, date: null, message: `Network error reaching wafid.com: ${e}` };
  }

  const csrfMatch = pageHtml.match(
    /name=["']csrfmiddlewaretoken["'][^>]*value=["']([^"']+)["']|value=["']([^"']+)["'][^>]*name=["']csrfmiddlewaretoken["']/,
  );
  const csrf = csrfMatch?.[1] ?? csrfMatch?.[2];
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
      await new Promise(r => setTimeout(r, 5000));
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

  // Step 4: Parse result HTML
  let status: string | null = null;
  let date: string | null = null;
  let message = "";

  const DATE_RE = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/;
  const DATE_RE_G = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/g;

  if (resultHtml.includes("medical-status-modal-acceptance") || />\s*fit\s*</i.test(resultHtml)) {
    status = "Fit";
    let rawDate: string | undefined;

    // Strategy 1: field_name / field_value in same <tr>
    for (const rowMatch of resultHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const row = rowMatch[1];
      const nameEl = row.match(/class=["'][^"']*field_name[^"']*["'][^>]*>([\s\S]*?)<\/(?:td|th|div|span)/i);
      if (!nameEl) continue;
      const nameText = nameEl[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!/examination\s*date/i.test(nameText)) continue;
      const valEl = row.match(/class=["'][^"']*field_value[^"']*["'][^>]*>([\s\S]*?)<\/(?:td|th|div|span)/i);
      if (!valEl) continue;
      rawDate = valEl[1].replace(/<[^>]+>/g, " ").trim().match(DATE_RE)?.[0];
      if (rawDate) break;
    }

    // Strategy 2: plain-text scan around "examination date" label
    if (!rawDate) {
      const plain = resultHtml
        .replace(/<[^>]+>/g, " ")
        .replace(/&[a-zA-Z]+;/g, " ")
        .replace(/\s+/g, " ");
      const idx = plain.search(/examination\s*date\s*:?/i);
      if (idx !== -1) rawDate = plain.slice(idx, idx + 80).match(DATE_RE)?.[0];
    }

    // Strategy 3: year-range heuristic (exam date ≤ currentYear+1, not 4+ years out)
    if (!rawDate) {
      const currentYear = new Date().getFullYear();
      rawDate = [...resultHtml.matchAll(DATE_RE_G)]
        .map(m => m[0])
        .find(d => {
          const parts = d.split(/[\/\-]/);
          const yr = parseInt(parts.find((p: string) => p.length === 4) ?? "0");
          return yr >= currentYear - 1 && yr <= currentYear + 1;
        });
    }

    if (rawDate) {
      const parts = rawDate.split(/[\/\-]/).map((p: string) => p.padStart(2, "0"));
      date = parts[2].length === 4 ? `${parts[2]}-${parts[1]}-${parts[0]}` : rawDate;
    }
  } else if (
    resultHtml.includes("medical-status-modal-rejection") ||
    />\s*unfit\s*</i.test(resultHtml)
  ) {
    status = "Unfit";
  } else if (
    />\s*in[\s-]*progress\s*</i.test(resultHtml) ||
    /class="status"[^>]*>\s*in[\s-]*progress/i.test(resultHtml)
  ) {
    status = "In progress";
  } else if (
    resultHtml.includes("medical-status-modal-normal") ||
    />\s*retest\s*</i.test(resultHtml)
  ) {
    status = "Retest";
  } else if (
    /no medical report found|no active appointment found|no[- ]record|not found|invalid passport/i.test(
      resultHtml,
    )
  ) {
    status = "No";
    message = "No record on Wafid";
  } else if (/error verifying recaptcha/i.test(resultHtml)) {
    message = "reCAPTCHA verification failed";
  } else {
    const snippet = resultHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
    message = `Could not determine status. Response: ${snippet}`;
  }

  return {
    status,
    date,
    message: message || (status ? `${status}${date ? ` · ${date}` : ""}` : "No result"),
  };
}
