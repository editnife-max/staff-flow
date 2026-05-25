import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const registerManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ full_name: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Idempotency — don't double-assign
    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) throw new Error("This account already has a role assigned.");

    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: context.userId,
      role: "manager",
    } as never);
    if (roleErr) throw new Error(roleErr.message);

    const { error: profErr } = await supabaseAdmin.from("profiles").upsert({
      id: context.userId,
      full_name: data.full_name,
    } as never);
    if (profErr) throw new Error(profErr.message);

    return { ok: true };
  });
