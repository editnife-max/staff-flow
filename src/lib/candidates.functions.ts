import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const StatusEnum = z.enum(["available", "processing", "arrived", "canceled", "returned"]);

const CandidateInput = z.object({
  full_name: z.string().min(1).max(200),
  first_name: z.string().max(100).optional().nullable(),
  last_name: z.string().max(100).optional().nullable(),
  serial_number: z.string().max(80).optional().nullable(),
  candidate_code: z.string().max(80).optional().nullable(),
  passport_number: z.string().max(80).optional().nullable(),
  labour_id: z.string().max(80).optional().nullable(),
  dob: z.string().optional().nullable(),
  occupation: z.string().max(120).optional().nullable(),
  country: z.string().max(120).optional().nullable(),
  age: z.number().int().min(0).max(120).optional().nullable(),
  gender: z.string().max(40).optional().nullable(),
  religion: z.string().max(80).optional().nullable(),
  birth_place: z.string().max(120).optional().nullable(),
  living_town: z.string().max(120).optional().nullable(),
  marital_status: z.string().max(40).optional().nullable(),
  children: z.number().int().min(0).max(30).optional().nullable(),
  education: z.string().max(120).optional().nullable(),
  passport_issue_date: z.string().optional().nullable(),
  passport_expiry_date: z.string().optional().nullable(),
  place_of_issue: z.string().max(120).optional().nullable(),
  spoken_languages: z.string().max(200).optional().nullable(),
  english_level: z.string().max(40).optional().nullable(),
  arabic_level: z.string().max(40).optional().nullable(),
  experience: z.string().max(120).optional().nullable(),
  experience_country: z.string().max(120).optional().nullable(),
  experience_years: z.string().max(40).optional().nullable(),
  weight: z.number().optional().nullable(),
  height: z.number().optional().nullable(),
  passport_status: z.string().max(80).optional().nullable(),
  medical_status: z.string().max(80).optional().nullable(),
  coc_status: z.string().max(80).optional().nullable(),
  musaned_status: z.string().max(80).optional().nullable(),
  office: z.string().max(80).optional().nullable(),
  selected_by: z.string().max(200).optional().nullable(),
  narrative: z.string().max(200).optional().nullable(),
  narrative_phone: z.string().max(80).optional().nullable(),
  skills: z.string().max(500).optional().nullable(),
  remark: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  availability_type: z.string().max(40).optional().nullable(),
  status: StatusEnum.default("available"),
  photo_url: z.preprocess((v) => (v === "" ? null : v), z.string().url().optional().nullable()),
  full_photo_url: z.preprocess((v) => (v === "" ? null : v), z.string().url().optional().nullable()),
  passport_scan_url: z.preprocess((v) => (v === "" ? null : v), z.string().url().optional().nullable()),
});

const InlineFieldSchema = z.object({
  id: z.string().uuid(),
  field: z.enum([
    "notes", "narrative", "occupation", "living_town", "selected_by",
    "medical_status", "status", "office", "passport_status",
    "musaned_status", "coc_status",
    // Processing module
    "passport_number", "labour_id",
    "narrative_phone", "contract_date", "medical_date", "medical_days",
    "tasheer_status", "tasheer_date", "wokala_status", "embassy_date",
    "visa_status", "insurance_status", "unfilled_lmis", "lmis_status",
    "ticket_status", "ticket_date", "arrival_city", "emergency_contact",
    "processing_notes", "remark",
    "destination_country", "cv_sent_to",
    "passport_accepted",
    "coc_agency_name", "coc_agency_phone",
    "insurance_date",
    "availability_type",
  ]),
  value: z.string().nullable(),
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
      const { error } = await (supabaseAdmin
        .from("candidates") as any)
        .update({ ...data.data })
        .eq("id", data.id)
        .eq("manager_id", managerId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    // Resolve "Added By" name from staff record (if creator is staff) or profile
    let createdByName: string | null = null;
    const { data: staffRow } = await supabaseAdmin
      .from("staff")
      .select("name")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (staffRow?.name) {
      createdByName = staffRow.name.trim().split(/\s+/)[0];
    } else {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", context.userId)
        .maybeSingle();
      if (profile?.full_name) createdByName = profile.full_name.trim().split(/\s+/)[0];
    }
    const { data: row, error } = await supabaseAdmin
      .from("candidates")
      .insert({
        ...data.data,
        manager_id: managerId,
        created_by_user_id: context.userId,
        created_by_name: createdByName,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const updateCandidateField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InlineFieldSchema.parse(input))
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const raw = data.value === "" ? null : data.value;
    // medical_days is stored as integer; passport_accepted is stored as boolean
    const coerced =
      data.field === "medical_days" && raw !== null ? Number(raw) :
      data.field === "passport_accepted" && raw !== null ? raw === "true" :
      raw;
    const payload: Record<string, unknown> = { [data.field]: coerced };

    const FIELD_TS_MAP: Record<string, string> = {
      visa_status: "visa_updated_at",
      ticket_status: "ticket_updated_at",
      ticket_date: "ticket_date_updated_at",
      arrival_city: "arrival_city_updated_at",
    };
    if (FIELD_TS_MAP[data.field]) {
      payload[FIELD_TS_MAP[data.field]] = raw !== null ? new Date().toISOString() : null;
    }

    if (data.field === "cv_sent_to" && raw) {
      payload.cv_sent_date = new Date().toISOString().split("T")[0];
    }

    // When selected_by is set on an available candidate, auto-advance to processing
    if (data.field === "selected_by" && raw) {
      const { data: cand } = await supabaseAdmin
        .from("candidates")
        .select("status, contract_date")
        .eq("id", data.id)
        .maybeSingle();
      if (cand?.status === "available") payload.status = "processing";
      if (!cand?.contract_date) payload.contract_date = new Date().toISOString().split("T")[0];
    }

    const { error } = await (supabaseAdmin.from("candidates") as any)
      .update(payload)
      .eq("id", data.id)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);

    const TRACKED_FIELDS = ["visa_status", "ticket_status", "ticket_date", "arrival_city"];
    if (TRACKED_FIELDS.includes(data.field)) {
      let changedByName = "Unknown";
      const { data: staffRow } = await supabaseAdmin.from("staff").select("name").eq("user_id", context.userId).maybeSingle();
      if (staffRow?.name) {
        changedByName = staffRow.name;
      } else {
        const { data: profile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
        if (profile?.full_name) changedByName = profile.full_name;
      }
      await supabaseAdmin.from("candidate_field_log").insert({
        candidate_id: data.id,
        field: data.field,
        new_value: raw,
        changed_by_user_id: context.userId,
        changed_by_name: changedByName,
      });
    }

    return { ok: true };
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

const IdList = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

export const bulkDeleteCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdList.parse(input))
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const { error, count } = await supabaseAdmin
      .from("candidates")
      .delete({ count: "exact" })
      .in("id", data.ids)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true, count: count ?? 0 };
  });

export const bulkUpdateStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    IdList.extend({ status: StatusEnum }).parse(input),
  )
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

export const bulkUpdateField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    IdList.extend({
      field: InlineFieldSchema.shape.field,
      value: z.string().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);
    const raw = data.value === "" ? null : data.value;
    const coercedBulk =
      data.field === "passport_accepted" && raw !== null ? raw === "true" : raw;
    const patch: Record<string, unknown> = { [data.field]: coercedBulk };
    if (data.field === "cv_sent_to" && raw) {
      patch.cv_sent_date = new Date().toISOString().split("T")[0];
    }
    const { error, count } = await supabaseAdmin
      .from("candidates")
      .update(patch as never, { count: "exact" })
      .in("id", data.ids)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true, count: count ?? 0 };
  });

export const bulkImportCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rows: z.array(CandidateInput).min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const managerId = await resolveManagerId(context.userId);

    let createdByName: string | null = null;
    const { data: staffRow } = await supabaseAdmin
      .from("staff")
      .select("name")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (staffRow?.name) {
      createdByName = staffRow.name.trim().split(/\s+/)[0];
    } else {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", context.userId)
        .maybeSingle();
      if (profile?.full_name) createdByName = profile.full_name.trim().split(/\s+/)[0];
    }

    const rows = data.rows.map((r) => ({
      ...r,
      manager_id: managerId,
      created_by_user_id: context.userId,
      created_by_name: createdByName,
    }));

    const { error, count } = await supabaseAdmin
      .from("candidates")
      .insert(rows as never[], { count: "exact" });
    if (error) throw new Error(error.message);
    return { ok: true, count: count ?? rows.length };
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
