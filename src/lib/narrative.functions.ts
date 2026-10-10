import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

const NarrativeInput = z.object({
  full_name:      z.string().max(200).optional().nullable(),
  occupation:     z.string().max(120).optional().nullable(),
  country:        z.string().max(120).optional().nullable(),
  experience:     z.string().max(120).optional().nullable(),
  education:      z.string().max(120).optional().nullable(),
  marital_status: z.string().max(40).optional().nullable(),
  children:       z.union([z.string(), z.number()]).optional().nullable(),
  religion:       z.string().max(80).optional().nullable(),
});

export const generateNarrative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => NarrativeInput.parse(input))
  .handler(async ({ data, context }) => {
    const userId = (context as { userId: string }).userId;

    // Rate limiting
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("narrative_gen_count, narrative_gen_reset_at")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) throw new Error("Failed to check rate limit");

    const now = Date.now();
    const resetAt = profile?.narrative_gen_reset_at
      ? new Date(profile.narrative_gen_reset_at).getTime()
      : now;
    const windowExpired = now > resetAt + RATE_LIMIT_WINDOW_MS;
    const currentCount = windowExpired ? 0 : (profile?.narrative_gen_count ?? 0);

    if (currentCount >= RATE_LIMIT_MAX) {
      const resetIn = Math.ceil((resetAt + RATE_LIMIT_WINDOW_MS - now) / 60000);
      throw new Error(
        `Rate limit reached. Try again in ${resetIn} minute${resetIn !== 1 ? "s" : ""}.`,
      );
    }

    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        narrative_gen_count: currentCount + 1,
        ...(windowExpired ? { narrative_gen_reset_at: new Date().toISOString() } : {}),
      },
      { onConflict: "id" },
    );

    const fields = [
      data.full_name      && `Name: ${data.full_name}`,
      data.occupation     && `Occupation: ${data.occupation}`,
      data.country        && `Nationality: ${data.country}`,
      data.marital_status && `Marital Status: ${data.marital_status}`,
      data.children != null && data.children !== "" && `Children: ${data.children}`,
      data.education      && `Education: ${data.education}`,
      data.experience     && `Work Experience: ${data.experience}`,
      data.religion       && `Religion: ${data.religion}`,
    ]
      .filter(Boolean)
      .join(", ");

    if (!fields) throw new Error("Please fill in at least one candidate field first.");

    const prompt = `Write a short professional recruitment narrative for this domestic worker candidate: ${fields}. Respond with ONLY the narrative text. Maximum 200 characters. No introductory phrases like "Here is" or "Narrative:".`;

    let text: string;
    try {
      const msg = await getClient().messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 120,
        messages: [{ role: "user", content: prompt }],
      });
      text = msg.content.find((b) => b.type === "text")?.text?.trim() ?? "";
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI service unavailable";
      throw new Error(`Narrative generation failed: ${message}`);
    }

    return { narrative: text.slice(0, 200) };
  });
