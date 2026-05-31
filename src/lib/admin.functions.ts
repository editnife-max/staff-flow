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
    const [managersRes, staffRes, agencyRes, pendingRes, approvedRes] = await Promise.all([
      supabaseAdmin.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "manager"),
      supabaseAdmin.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "staff"),
      supabaseAdmin.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "agency"),
      supabaseAdmin.from("subscription_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("subscription_requests").select("*", { count: "exact", head: true }).eq("status", "approved"),
    ]);
    return {
      managers: managersRes.count ?? 0,
      staff: staffRes.count ?? 0,
      agencies: agencyRes.count ?? 0,
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

export const forceResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), newPassword: z.string().min(8) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
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

export const createManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      full_name: z.string().min(1).max(200),
      email: z.string().email(),
      password: z.string().min(8),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { data: newUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (authErr) throw new Error(authErr.message);
    const userId = newUser.user.id;

    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId, role: "manager",
    } as never);
    if (roleErr) throw new Error(roleErr.message);

    const { error: profErr } = await supabaseAdmin.from("profiles").upsert({
      id: userId, full_name: data.full_name,
    } as never);
    if (profErr) throw new Error(profErr.message);

    return { ok: true, userId };
  });

// ── All-role user management ────────────────────────────────────────────────

export const getAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, manager_id, created_at")
      .order("created_at", { ascending: false });

    if (!roles || roles.length === 0) return [];
    const ids = [...new Set(roles.map((r) => r.user_id))];

    const [profilesRes, authRes, managersProfileRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, agency_name").in("id", ids) as any,
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
      // For staff rows, resolve manager name
      supabaseAdmin.from("profiles").select("id, full_name"),
    ]);

    const profileMap = Object.fromEntries(
      ((profilesRes.data ?? []) as any[]).map((p: any) => [p.id, { full_name: p.full_name, agency_name: p.agency_name }]),
    );
    const emailMap = Object.fromEntries(
      ((authRes.data as any)?.users ?? []).map((u: any) => [u.id, u.email as string]),
    );
    const allProfileMap = Object.fromEntries(
      (managersProfileRes.data ?? []).map((p) => [p.id, p.full_name]),
    );

    return roles.map((r) => ({
      id: r.user_id,
      role: r.role as string,
      manager_id: r.manager_id as string | null,
      manager_name: r.manager_id ? (allProfileMap[r.manager_id] ?? null) : null,
      full_name: (profileMap[r.user_id]?.full_name ?? null) as string | null,
      agency_name: (profileMap[r.user_id]?.agency_name ?? null) as string | null,
      email: (emailMap[r.user_id] ?? null) as string | null,
      joined: r.created_at,
    }));
  });

const RoleEnum = z.enum(["admin", "manager", "staff", "agency"]);

export const createAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      role: RoleEnum,
      full_name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8),
      manager_id: z.string().uuid().optional().nullable(),
      agency_name: z.string().optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);

    const { data: newUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (authErr) throw new Error(authErr.message);
    const userId = newUser.user.id;

    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: data.role,
      manager_id: data.manager_id ?? null,
    } as never);
    if (roleErr) throw new Error(roleErr.message);

    const { error: profErr } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      full_name: data.full_name,
      agency_name: data.agency_name ?? null,
    } as never);
    if (profErr) throw new Error(profErr.message);

    return { ok: true, userId };
  });

export const removeUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), role: RoleEnum }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("Cannot remove your own account");

    if (data.role === "agency") {
      // Agency users are system-created — delete the auth account entirely
      const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
      if (error) throw new Error(error.message);
    } else {
      // For other roles, revoke the role (keep the auth account)
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
