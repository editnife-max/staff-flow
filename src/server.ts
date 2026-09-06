import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { checkWafidForCandidate, wafidNationality } from "./lib/wafid-check";

async function runBulkMedicalCheck() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return;

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch up to 20 candidates (available/processing with passport), oldest-updated first
  // so every candidate gets cycled through evenly across the two daily runs.
  const { data: candidates } = await supabase
    .from("candidates")
    .select("id, passport_number, country, medical_status")
    .in("status", ["available", "processing"])
    .not("passport_number", "is", null)
    .neq("passport_number", "")
    .order("updated_at", { ascending: true })
    .limit(20);

  if (!candidates?.length) return;

  // Check all candidates in parallel — captchas solve simultaneously (~25s total).
  await Promise.allSettled(
    candidates.map(async (candidate) => {
      const passport = candidate.passport_number!.trim().toUpperCase();
      const nationality = wafidNationality(candidate.country);
      const result = await checkWafidForCandidate(passport, nationality);

      if (result.status) {
        const today = new Date().toISOString().split("T")[0];
        if (
          result.status === "Fit" ||
          candidate.medical_status === "Expired" ||
          result.status !== candidate.medical_status
        ) {
          await supabase
            .from("candidates")
            .update({
              medical_status: result.status,
              medical_date: result.status === "No" ? null : (result.date ?? today),
            })
            .eq("id", candidate.id);
        }
      }
    }),
  );
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

const startHandler = createStartHandler(defaultStreamHandler);

async function fetchWithSecurityHeaders(request: Request, env: unknown, ctx: unknown): Promise<Response> {
  const response = await (startHandler as (req: Request, env: unknown, ctx: unknown) => Promise<Response>)(request, env, ctx);
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!newHeaders.has(key)) newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export default {
  fetch: fetchWithSecurityHeaders,

  async scheduled(
    _event: unknown,
    _env: unknown,
    ctx: { waitUntil: (p: Promise<unknown>) => void },
  ) {
    ctx.waitUntil(runBulkMedicalCheck());
  },
};
