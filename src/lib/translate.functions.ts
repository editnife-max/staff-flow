import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import Anthropic from "@anthropic-ai/sdk";

// Lazy-initialise so missing key throws at call-time, not module load
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

export const translateNamesToArabic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ names: z.array(z.string().min(1)).min(1).max(50) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { names } = data as { names: string[] };

    const prompt = `You are a name transliteration expert. Transliterate these names into Arabic script.
Rules:
- Transliterate phonetically into Arabic (do not translate meaning)
- If a name is already Arabic, keep it as is
- Return ONLY a JSON object mapping each original name to its Arabic transliteration
- No extra text, no markdown, just the JSON object

Names:
${names.map((n: string, i: number) => `${i + 1}. ${n}`).join("\n")}

Return format: {"Original Name": "الاسم بالعربية", ...}`;

    let text: string;
    try {
      const msg = await getClient().messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });
      text = msg.content.find((b) => b.type === "text")?.text ?? "{}";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Translation service unavailable";
      throw new Error(`Translation failed: ${message}`);
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {} as Record<string, string>;

    try {
      return JSON.parse(jsonMatch[0]) as Record<string, string>;
    } catch {
      return {} as Record<string, string>;
    }
  });
