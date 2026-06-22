import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const removeCandidateFromAgency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("agency_name")
      .eq("id", context.userId)
      .maybeSingle();

    if (!(profile as any)?.agency_name) throw new Error("Not an agency user");

    const { error } = await (supabaseAdmin.from("candidates") as any)
      .update({ cv_sent_to: null, cv_sent_date: null })
      .eq("id", data.id)
      .eq("cv_sent_to", (profile as any).agency_name);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
