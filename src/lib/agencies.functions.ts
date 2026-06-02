import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function resolveManagerId(userId: string): Promise<string> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role, manager_id")
    .eq("user_id", userId);
  const mgr = roles?.find((r) => r.role === "manager");
  if (mgr) return userId;
  throw new Response("No manager scope", { status: 403 });
}

export const createAgencyLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      agencyId: z.string().uuid(),
      agencyName: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await resolveManagerId(context.userId);

    // Create auth user — user_metadata.role is read by the on_auth_user_created
    // trigger, which inserts the correct role into user_roles automatically.
    const { data: newUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { role: "agency" },
    });
    if (authErr) throw new Error(authErr.message);
    const userId = newUser.user.id;

    // Set agency_name in profiles
    const { error: profErr } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      agency_name: data.agencyName,
    } as never);
    if (profErr) throw new Error(profErr.message);

    // Link portal_user_id on the agency row
    const { error: agErr } = await (supabaseAdmin.from("foreign_agencies") as any)
      .update({ portal_user_id: userId })
      .eq("id", data.agencyId);
    if (agErr) throw new Error(agErr.message);

    return { ok: true, userId };
  });

export const resetAgencyPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ portalUserId: z.string().uuid(), newPassword: z.string().min(8) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await resolveManagerId(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.portalUserId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAgencyLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      agencyId: z.string().uuid(),
      portalUserId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await resolveManagerId(context.userId);

    // Clear link first so ON DELETE SET NULL doesn't race
    const { error: agErr } = await (supabaseAdmin.from("foreign_agencies") as any)
      .update({ portal_user_id: null })
      .eq("id", data.agencyId);
    if (agErr) throw new Error(agErr.message);

    // Delete auth user (cascades to user_roles + profiles via FK)
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.portalUserId);
    if (delErr) throw new Error(delErr.message);

    return { ok: true };
  });
