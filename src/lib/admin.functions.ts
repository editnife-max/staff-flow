import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requireAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const [managersRes, pendingRes, approvedRes] = await Promise.all([
      supabaseAdmin.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "manager"),
      supabaseAdmin.from("subscription_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("subscription_requests").select("*", { count: "exact", head: true }).eq("status", "approved"),
    ]);
    return {
      managers: managersRes.count ?? 0,
      pendingSubs: pendingRes.count ?? 0,
      approvedPlans: approvedRes.count ?? 0,
    };
  });

export const getAdminSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("subscription_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const managerIds = [...new Set((data ?? []).map((r) => r.manager_id))];
    if (managerIds.length === 0) return [];

    const [profilesRes, authRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").in("id", managerIds),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    const profileMap = Object.fromEntries((profilesRes.data ?? []).map((p) => [p.id, p.full_name]));
    const emailMap = Object.fromEntries(
      ((authRes.data as any)?.users ?? []).map((u: any) => [u.id, u.email as string]),
    );

    return (data ?? []).map((r) => ({
      ...r,
      manager_name: profileMap[r.manager_id] ?? null,
      manager_email: (emailMap[r.manager_id] ?? null) as string | null,
    }));
  });

export const updateSubscriptionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["approved", "rejected"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("subscription_requests")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAdminManagers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, created_at")
      .eq("role", "manager")
      .order("created_at", { ascending: false });

    if (!roles || roles.length === 0) return [];
    const ids = roles.map((r) => r.user_id);

    const [profilesRes, subRes, authRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").in("id", ids),
      supabaseAdmin
        .from("subscription_requests")
        .select("manager_id, plan, status, updated_at")
        .in("manager_id", ids)
        .eq("status", "approved")
        .order("updated_at", { ascending: false }),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    const profileMap = Object.fromEntries((profilesRes.data ?? []).map((p) => [p.id, p.full_name]));
    const emailMap = Object.fromEntries(
      ((authRes.data as any)?.users ?? []).map((u: any) => [u.id, u.email as string]),
    );
    const planMap: Record<string, { plan: string; since: string }> = {};
    for (const s of subRes.data ?? []) {
      if (!planMap[s.manager_id]) planMap[s.manager_id] = { plan: s.plan, since: s.updated_at };
    }

    return roles.map((r) => ({
      id: r.user_id,
      full_name: profileMap[r.user_id] ?? null,
      email: (emailMap[r.user_id] ?? null) as string | null,
      joined: r.created_at,
      active_plan: planMap[r.user_id] ?? null,
    }));
  });

export const removeManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "manager");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
