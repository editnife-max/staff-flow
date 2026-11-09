import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OverrideType = "column_edit" | "page_access";
export type OverrideMode = "grant" | "deny";

export type StaffOverride = {
  id: string;
  staff_user_id: string;
  type: OverrideType;
  target: string;
  mode: OverrideMode;
};

export const getStaffOverrides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ staffUserId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("staff_permission_overrides")
      .select("id, staff_user_id, type, target, mode")
      .eq("manager_id", context.userId)
      .eq("staff_user_id", data.staffUserId);
    if (error) throw new Error(error.message);
    return (rows ?? []) as StaffOverride[];
  });

export const setStaffOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      staffUserId: z.string().uuid(),
      type: z.enum(["column_edit", "page_access"]),
      target: z.string().min(1),
      mode: z.enum(["grant", "deny"]),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("staff_permission_overrides")
      .upsert(
        {
          manager_id: context.userId,
          staff_user_id: data.staffUserId,
          type: data.type,
          target: data.target,
          mode: data.mode,
        },
        { onConflict: "manager_id,staff_user_id,type,target" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyEffectiveAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("manager_id")
      .eq("user_id", context.userId)
      .eq("role", "staff")
      .maybeSingle();

    const managerId = roleRow?.manager_id;
    if (!managerId) return { restrictedColumns: [] as string[], grantedColumns: [] as string[], deniedColumns: [] as string[], deniedPages: [] as string[] };

    const [profileRes, overridesRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("restricted_columns").eq("id", managerId).maybeSingle(),
      (supabaseAdmin as any)
        .from("staff_permission_overrides")
        .select("type, target, mode")
        .eq("manager_id", managerId)
        .eq("staff_user_id", context.userId),
    ]);

    const raw = ((profileRes.data as any)?.restricted_columns ?? {}) as Record<string, boolean>;
    const restrictedColumns = Object.keys(raw).filter((k) => raw[k] === true);
    const overrides: Array<{ type: string; target: string; mode: string }> = overridesRes.data ?? [];

    return {
      restrictedColumns,
      grantedColumns:  overrides.filter((o) => o.type === "column_edit"  && o.mode === "grant").map((o) => o.target),
      deniedColumns:   overrides.filter((o) => o.type === "column_edit"  && o.mode === "deny").map((o) => o.target),
      deniedPages:     overrides.filter((o) => o.type === "page_access"  && o.mode === "deny").map((o) => o.target),
    };
  });

export const clearStaffOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      staffUserId: z.string().uuid(),
      type: z.enum(["column_edit", "page_access"]),
      target: z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("staff_permission_overrides")
      .delete()
      .eq("manager_id", context.userId)
      .eq("staff_user_id", data.staffUserId)
      .eq("type", data.type)
      .eq("target", data.target);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
