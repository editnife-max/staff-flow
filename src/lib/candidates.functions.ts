import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const StatusEnum = z.enum(["available", "processing", "arrived", "canceled"]);

const CandidateInput = z.object({
  full_name: z.string().min(1).max(200),
  serial_number: z.string().max(80).optional().nullable(),
  passport_number: z.string().max(80).optional().nullable(),
  dob: z.string().optional().nullable(),
  occupation: z.string().max(120).optional().nullable(),
  country: z.string().max(120).optional().nullable(),
  age: z.number().int().min(0).max(120).optional().nullable(),
  gender: z.string().max(40).optional().nullable(),
  religion: z.string().max(80).optional().nullable(),
  marital_status: z.string().max(40).optional().nullable(),
  education: z.string().max(120).optional().nullable(),
  skills: z.string().max(500).optional().nullable(),
  status: StatusEnum.default("available"),
  photo_url: z.string().url().optional().nullable(),
});

async function resolveManagerId(userId: string): Promise<string> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role, manager_id")
    .eq("user_id", userId);
  const mgr = roles?.find((r) => r.role === "manager");
  if (mgr) return userId;
  const staff = roles?.find((r) => r.role === "staff");
  if (staff?.manager_id) return staff.manager_id;
  throw new Response("No manager scope", { status: 403 });
}

export const upsertCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid().optional(), data: CandidateInput }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("candidates")
        .update({ ...data.data })
        .eq("id", data.id)
        .eq("manager_id", managerId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("candidates")
      .insert({ ...data.data, manager_id: managerId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const { error } = await supabaseAdmin
      .from("candidates")
      .delete()
      .eq("id", data.id)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
