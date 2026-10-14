import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function resolveManagerId(userId: string): Promise<string | null> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role, manager_id")
    .eq("user_id", userId);
  const staffRole = roles?.find((r) => r.role === "staff" && r.manager_id);
  if (staffRole?.manager_id) return staffRole.manager_id as string;
  const mgr = roles?.find((r) => r.role === "manager");
  if (mgr) return userId;
  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("manager_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (staffRow?.manager_id) return staffRow.manager_id as string;
  return null;
}

export const getManagerTcEnabled = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const managerId = await resolveManagerId(context.userId);
    if (!managerId) return { tc_enabled: true };
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("tc_enabled")
      .eq("id", managerId)
      .maybeSingle();
    return { tc_enabled: data?.tc_enabled ?? true };
  });

export const setManagerTcEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ tc_enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isManager = roles?.some((r) => r.role === "manager" || r.role === "admin");
    if (!isManager) throw new Error("Managers only");
    await supabaseAdmin
      .from("profiles")
      .update({ tc_enabled: data.tc_enabled })
      .eq("id", context.userId);
    return { ok: true };
  });
