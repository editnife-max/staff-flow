// Server functions for Custom CV templates (custom_cv_templates).
// A manager owns their company's templates; their staff may use the active ones.
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeConfig, type CustomCvConfig } from "@/components/custom-cv/config";

export interface CustomCvTemplate {
  id: string;
  name: string;
  isActive: boolean;
  config: CustomCvConfig;
  updatedAt: string;
}

const TABLE = "custom_cv_templates";
const MAX_TEMPLATES = 30;
const MAX_CONFIG_BYTES = 60_000;

type Company = { managerId: string; canEdit: boolean };

async function admin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The table is newer than the generated types (regenerate them to drop this cast).
  return supabaseAdmin as unknown as SupabaseClient;
}

/** The caller's company: managers own one; staff belong to their manager's. */
async function companyOf(userId: string): Promise<Company | null> {
  const db = await admin();
  const { data, error } = await db
    .from("user_roles")
    .select("role, manager_id")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []) as Array<{ role: string; manager_id: string | null }>;
  if (roles.some((r) => r.role === "manager")) return { managerId: userId, canEdit: true };
  const staff = roles.find((r) => r.role === "staff" && r.manager_id);
  return staff ? { managerId: staff.manager_id!, canEdit: false } : null;
}

async function requireManager(userId: string): Promise<string> {
  const company = await companyOf(userId);
  if (!company?.canEdit) throw new Error("Only managers can change Custom CV templates.");
  return company.managerId;
}

function toTemplate(r: {
  id: string;
  name: string;
  is_active: boolean;
  config: unknown;
  updated_at: string;
}): CustomCvTemplate {
  return {
    id: r.id,
    name: r.name,
    isActive: r.is_active,
    config: normalizeConfig(r.config),
    updatedAt: r.updated_at,
  };
}

/** Logos must live in our storage under the manager's own custom-cv folder. */
function checkLogo(config: CustomCvConfig, managerId: string): CustomCvConfig {
  const url = config.header.logoUrl;
  const base = `${process.env.SUPABASE_URL}/storage/v1/object/public/candidate-files/custom-cv/${managerId}/`;
  if (url && !url.startsWith(base))
    return { ...config, header: { ...config.header, logoUrl: null } };
  return config;
}

/**
 * Templates the caller may use. Managers get all of theirs (with inactive ones);
 * staff get their company's active templates; anyone else gets none.
 */
export const listCustomCvTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const company = await companyOf(context.userId);
    if (!company) return { canEdit: false, templates: [] as CustomCvTemplate[] };
    const db = await admin();
    let q = db
      .from(TABLE)
      .select("id, name, is_active, config, updated_at")
      .eq("manager_id", company.managerId);
    if (!company.canEdit) q = q.eq("is_active", true);
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return {
      canEdit: company.canEdit,
      templates: (data ?? []).map(toTemplate) as CustomCvTemplate[],
    };
  });

const SaveInput = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1, "Give the template a name").max(60),
  isActive: z.boolean(),
  config: z.unknown(),
});

export const saveCustomCvTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ context, data }) => {
    const managerId = await requireManager(context.userId);
    const config = checkLogo(normalizeConfig(data.config), managerId);
    if (JSON.stringify(config).length > MAX_CONFIG_BYTES)
      throw new Error("This template is too large to save.");
    const db = await admin();
    const row = { name: data.name, is_active: data.isActive, config };

    if (data.id) {
      const { data: saved, error } = await db
        .from(TABLE)
        .update(row)
        .eq("id", data.id)
        .eq("manager_id", managerId)
        .select("id, name, is_active, config, updated_at")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!saved) throw new Error("Template not found.");
      return toTemplate(saved);
    }

    const { count, error: countError } = await db
      .from(TABLE)
      .select("id", { count: "exact", head: true })
      .eq("manager_id", managerId);
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) >= MAX_TEMPLATES)
      throw new Error(`You can keep up to ${MAX_TEMPLATES} Custom CV templates.`);
    const { data: saved, error } = await db
      .from(TABLE)
      .insert({ ...row, manager_id: managerId, created_by: context.userId })
      .select("id, name, is_active, config, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return toTemplate(saved);
  });

export const setCustomCvTemplateActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const managerId = await requireManager(context.userId);
    const db = await admin();
    const { error } = await db
      .from(TABLE)
      .update({ is_active: data.isActive })
      .eq("id", data.id)
      .eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCustomCvTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const managerId = await requireManager(context.userId);
    const db = await admin();
    const { error } = await db.from(TABLE).delete().eq("id", data.id).eq("manager_id", managerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
