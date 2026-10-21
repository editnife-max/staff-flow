import { createServerFn } from "@tanstack/react-start";
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
      .select("cv_page_requirements")
      .eq("id", managerId)
      .maybeSingle();
    const tc_enabled = (data?.cv_page_requirements as any)?.tc_enabled !== false;
    return { tc_enabled };
  });

export const getManagerTcCriteria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const managerId = await resolveManagerId(context.userId);
    if (!managerId) return { tc_criteria_keys: null };
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("cv_page_requirements")
      .eq("id", managerId)
      .maybeSingle();
    const keys = (data?.cv_page_requirements as any)?.tc_criteria_keys;
    return { tc_criteria_keys: Array.isArray(keys) ? (keys as string[]) : null };
  });
