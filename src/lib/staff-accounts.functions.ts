import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CreateStaffSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(72),
  roleTitle: z.string().max(120).optional().nullable(),
});

export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateStaffSchema.parse(input))
  .handler(async ({ data, context }) => {
    const managerId = context.userId;

    // Verify caller is a manager
    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", managerId);
    if (rolesErr) throw new Error(rolesErr.message);
    if (!roles?.some((r) => r.role === "manager")) {
      throw new Response("Forbidden: only managers can create staff", { status: 403 });
    }

    // Create the auth user (auto-confirmed)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.name, role: "staff" },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Failed to create user");
    }
    const newUserId = created.user.id;

    // Ensure profile row
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: newUserId, full_name: data.name }, { onConflict: "id" });

    // Ensure user_roles row (role=staff, scoped to this manager)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: newUserId,
      role: "staff",
      manager_id: managerId,
    });
    if (roleErr) throw new Error(roleErr.message);

    // Create staff record linked to manager
    const { error: staffErr } = await supabaseAdmin.from("staff").insert({
      manager_id: managerId,
      user_id: newUserId,
      name: data.name,
      email: data.email,
      role_title: data.roleTitle ?? null,
      status: "active",
    });
    if (staffErr) throw new Error(staffErr.message);

    return { ok: true, userId: newUserId };
  });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ staffId: z.string().uuid(), newPassword: z.string().min(6) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const managerId = context.userId;
    const { data: row, error } = await supabaseAdmin
      .from("staff")
      .select("user_id, manager_id")
      .eq("id", data.staffId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.manager_id !== managerId) throw new Response("Not found", { status: 404 });
    if (!row.user_id) throw new Error("Staff member has no auth account");
    const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, {
      password: data.newPassword,
    });
    if (pwErr) throw new Error(pwErr.message);
    return { ok: true };
  });

export const deleteStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ staffId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const managerId = context.userId;
    const { data: row, error } = await supabaseAdmin
      .from("staff")
      .select("id, user_id, manager_id")
      .eq("id", data.staffId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.manager_id !== managerId) {
      throw new Response("Not found", { status: 404 });
    }
    await supabaseAdmin.from("staff").delete().eq("id", row.id);
    if (row.user_id) {
      await supabaseAdmin.auth.admin.deleteUser(row.user_id);
    }
    return { ok: true };
  });
