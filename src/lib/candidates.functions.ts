import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const StatusEnum = z.enum(["available", "processing", "arrived", "canceled"]);
const MedicalEnum = z.enum(["pending", "fit", "unfit"]);
const PassportEnum = z.enum(["pending", "submitted", "received", "expired"]);
const DocEnum = z.enum(["pending", "in_progress", "done", "rejected"]);
const OfficeEnum = z.enum(["saudi", "kuwait", "uae", "qatar", "bahrain", "oman", "other"]);

const CandidateInput = z.object({
  full_name: z.string().min(1).max(200),
  candidate_code: z.string().max(40).optional().nullable(),
  serial_number: z.string().max(80).optional().nullable(),
  passport_number: z.string().max(80).optional().nullable(),
  labour_id: z.string().max(80).optional().nullable(),
  dob: z.string().optional().nullable(),
  occupation: z.string().max(120).optional().nullable(),
  country: z.string().max(120).optional().nullable(),
  birth_place: z.string().max(120).optional().nullable(),
  living_town: z.string().max(120).optional().nullable(),
  age: z.number().int().min(0).max(120).optional().nullable(),
  gender: z.string().max(40).optional().nullable(),
  religion: z.string().max(80).optional().nullable(),
  marital_status: z.string().max(40).optional().nullable(),
  education: z.string().max(120).optional().nullable(),
  skills: z.string().max(500).optional().nullable(),
  status: StatusEnum.default("available"),
  office: OfficeEnum.optional().nullable(),
  passport_status: PassportEnum.optional(),
  coc_status: DocEnum.optional(),
  musaned_status: DocEnum.optional(),
  medical_status: MedicalEnum.optional(),
  medical_date: z.string().optional().nullable(),
  selected_by: z.string().max(120).optional().nullable(),
  cv_sent_to: z.string().max(120).optional().nullable(),
  cv_sent_date: z.string().optional().nullable(),
  narrative: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
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

// ── List ─────────────────────────────────────────────────────────────
const ListInput = z.object({
  search: z.string().optional(),
  status: StatusEnum.optional(),
  medical: MedicalEnum.optional(),
  office: OfficeEnum.optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export const listCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    let q = supabaseAdmin
      .from("candidates")
      .select("*")
      .eq("manager_id", managerId)
      .is("deleted_at", null);
    if (data.search) {
      const s = data.search.replace(/[%,]/g, " ").trim();
      if (s) q = q.or(`full_name.ilike.%${s}%,candidate_code.ilike.%${s}%`);
    }
    if (data.status) q = q.eq("status", data.status);
    if (data.medical) q = q.eq("medical_status", data.medical);
    if (data.office) q = q.eq("office", data.office);
    const sortBy = data.sortBy ?? "created_at";
    const ascending = (data.sortDir ?? "desc") === "asc";
    q = q.order(sortBy, { ascending, nullsFirst: false });
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ── Upsert ──────────────────────────────────────────────────────────
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

// ── Inline field update (whitelist) ─────────────────────────────────
const EDITABLE_FIELDS = [
  "full_name", "candidate_code", "passport_number", "labour_id",
  "occupation", "living_town", "birth_place", "country",
  "office", "passport_status", "coc_status", "musaned_status",
  "medical_status", "medical_date", "status",
  "selected_by", "cv_sent_to", "cv_sent_date",
  "narrative", "notes",
] as const;

const FieldUpdateInput = z.object({
  id: z.string().uuid(),
  field: z.enum(EDITABLE_FIELDS),
  value: z.union([z.string(), z.number(), z.null()]),
});

export const updateCandidateField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FieldUpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const patch = { [data.field]: data.value } as never;
    const { error } = await supabaseAdmin
      .from("candidates")
      .update(patch)
      .eq("id", data.id)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Soft delete ─────────────────────────────────────────────────────
const IdList = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

export const softDeleteCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const { error } = await supabaseAdmin
      .from("candidates")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkSoftDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdList.parse(input))
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const { error, count } = await supabaseAdmin
      .from("candidates")
      .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
      .in("id", data.ids)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true, count: count ?? 0 };
  });

// ── Bulk field update ───────────────────────────────────────────────
const BULK_FIELDS = [
  "status", "medical_status", "office",
  "passport_status", "coc_status", "musaned_status",
] as const;

const BulkFieldInput = IdList.extend({
  field: z.enum(BULK_FIELDS),
  value: z.string(),
});

export const bulkUpdateField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BulkFieldInput.parse(input))
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const patch = { [data.field]: data.value } as never;
    const { error, count } = await supabaseAdmin
      .from("candidates")
      .update(patch, { count: "exact" })
      .in("id", data.ids)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true, count: count ?? 0 };
  });

// ── Legacy aliases (kept for backward compat) ───────────────────────
export const deleteCandidate = softDeleteCandidate;
export const bulkDeleteCandidates = bulkSoftDelete;

export const bulkUpdateStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdList.extend({ status: StatusEnum }).parse(input))
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const { error, count } = await supabaseAdmin
      .from("candidates")
      .update({ status: data.status }, { count: "exact" })
      .in("id", data.ids)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true, count: count ?? 0 };
  });

export const bulkAssignStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    IdList.extend({ staff_id: z.string().uuid().nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    if (data.staff_id) {
      const { data: staffRow, error: sErr } = await supabaseAdmin
        .from("staff")
        .select("id")
        .eq("id", data.staff_id)
        .eq("manager_id", managerId)
        .maybeSingle();
      if (sErr) throw new Error(sErr.message);
      if (!staffRow) throw new Error("Staff not in your team");
    }
    const { error, count } = await supabaseAdmin
      .from("candidates")
      .update({ assigned_staff_id: data.staff_id }, { count: "exact" })
      .in("id", data.ids)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true, count: count ?? 0 };
  });
