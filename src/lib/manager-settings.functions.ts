import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getColumnRestrictions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("restricted_columns")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const raw = ((data as any)?.restricted_columns ?? {}) as Record<string, boolean>;
    return Object.keys(raw).filter((k) => raw[k] === true);
  });

export const setColumnRestrictions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ columns: z.array(z.string()) }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const restrictedMap = Object.fromEntries(data.columns.map((k) => [k, true]));
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ restricted_columns: restrictedMap } as any)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
