import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const translateNamesToArabic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ names: z.array(z.string()).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { names } = data as { names: string[] };
    if (!names.length) return {} as Record<string, string>;

    const prompt = `You are a name transliteration expert. Transliterate these names into Arabic script.
Rules:
- Transliterate phonetically into Arabic (do not translate meaning)
- If a name is already Arabic, keep it as is
- Return ONLY a JSON object mapping each original name to its Arabic transliteration
- No extra text, no markdown, just the JSON object

Names:
${names.map((n: string, i: number) => `${i + 1}. ${n}`).join("\n")}

Return format: {"Original Name": "الاسم بالعربية", ...}`;

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content.find((b) => b.type === "text")?.text ?? "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {} as Record<string, string>;

    try {
      return JSON.parse(jsonMatch[0]) as Record<string, string>;
    } catch {
      return {} as Record<string, string>;
    }
  });
