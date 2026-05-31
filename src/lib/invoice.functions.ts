import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getAgencyUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles" as any)
      .select("user_id")
      .eq("role", "agency");
    if (error) throw new Error(error.message);

    const ids = ((roles ?? []) as any[]).map((r) => r.user_id as string);
    if (!ids.length) return [] as { user_id: string; name: string }[];

    const { data: profiles } = (await supabaseAdmin
      .from("profiles")
      .select("id, full_name, agency_name")
      .in("id", ids)) as any;

    return ((profiles ?? []) as any[]).map((p) => ({
      user_id: p.id as string,
      name: (p.agency_name ?? p.full_name ?? "Agency") as string,
    }));
  });

export const sendInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      agencyUserId:   z.string().uuid(),
      invoiceNumber:  z.string(),
      officeName:     z.string().optional(),
      dateFrom:       z.string().optional(),
      dateTo:         z.string().optional(),
      candidateIds:   z.array(z.string()).default([]),
      fromCompany:    z.string().optional(),
      fromAddress:    z.string().optional(),
      fromPhone:      z.string().optional(),
      fromEmail:      z.string().optional(),
      paymentName:    z.string().optional(),
      paymentAccount: z.string().optional(),
      paymentBranch:  z.string().optional(),
      recruFee:       z.number().default(0),
      otherExpenses:  z.number().default(0),
      subtotal:       z.number().default(0),
      total:          z.number().default(0),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: inv, error: invErr } = await supabaseAdmin
      .from("invoices" as any)
      .insert({
        invoice_number:  data.invoiceNumber,
        manager_user_id: context.userId,
        agency_user_id:  data.agencyUserId,
        office_name:     data.officeName ?? null,
        date_from:       data.dateFrom   ?? null,
        date_to:         data.dateTo     ?? null,
        candidate_ids:   data.candidateIds,
        from_company:    data.fromCompany    ?? null,
        from_address:    data.fromAddress    ?? null,
        from_phone:      data.fromPhone      ?? null,
        from_email:      data.fromEmail      ?? null,
        payment_name:    data.paymentName    ?? null,
        payment_account: data.paymentAccount ?? null,
        payment_branch:  data.paymentBranch  ?? null,
        recru_fee:      data.recruFee,
        other_expenses: data.otherExpenses,
        subtotal:       data.subtotal,
        total:          data.total,
        status:         "sent",
      })
      .select("id")
      .single();
    if (invErr) throw new Error(invErr.message);

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("full_name").eq("id", context.userId).maybeSingle() as any;
    const managerName = (profile as any)?.full_name ?? "Manager";

    const { error: notifErr } = await supabaseAdmin.from("notifications" as any).insert({
      recipient_id:  data.agencyUserId,
      sender_id:     context.userId,
      type:          "invoice_sent",
      title:         `${managerName} sent you invoice ${data.invoiceNumber}`,
      body:          data.officeName ?? null,
      candidate_ids: [],
      read:          false,
      status:        "pending",
      reference_id:  (inv as any).id,
    });
    if (notifErr) throw new Error(notifErr.message);

    return { ok: true, invoiceId: (inv as any).id as string };
  });

export const markInvoicePaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ invoiceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: inv, error: fetchErr } = await supabaseAdmin
      .from("invoices" as any)
      .select("manager_user_id, invoice_number, office_name")
      .eq("id", data.invoiceId)
      .eq("agency_user_id", context.userId)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);

    await supabaseAdmin.from("invoices" as any).update({ status: "paid" }).eq("id", data.invoiceId);

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("full_name, agency_name").eq("id", context.userId).maybeSingle() as any;
    const agencyName = (profile as any)?.agency_name ?? (profile as any)?.full_name ?? "Agency";

    await supabaseAdmin.from("notifications" as any).insert({
      recipient_id:  (inv as any).manager_user_id,
      sender_id:     context.userId,
      type:          "invoice_paid",
      title:         `${agencyName} paid invoice ${(inv as any).invoice_number}`,
      body:          (inv as any).office_name ?? null,
      candidate_ids: [],
      read:          false,
      status:        "pending",
      reference_id:  data.invoiceId,
    });

    await supabaseAdmin.from("notifications" as any)
      .update({ status: "accepted", read: true })
      .eq("reference_id", data.invoiceId)
      .eq("recipient_id", context.userId)
      .eq("type", "invoice_sent");

    return { ok: true };
  });

export const confirmInvoicePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ invoiceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: inv, error: fetchErr } = await supabaseAdmin
      .from("invoices" as any)
      .select("agency_user_id, invoice_number")
      .eq("id", data.invoiceId)
      .eq("manager_user_id", context.userId)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);

    await supabaseAdmin.from("invoices" as any).update({ status: "confirmed" }).eq("id", data.invoiceId);

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("full_name").eq("id", context.userId).maybeSingle() as any;
    const managerName = (profile as any)?.full_name ?? "Manager";

    await supabaseAdmin.from("notifications" as any).insert({
      recipient_id:  (inv as any).agency_user_id,
      sender_id:     context.userId,
      type:          "invoice_confirmed",
      title:         `${managerName} confirmed your payment for invoice ${(inv as any).invoice_number}`,
      body:          null,
      candidate_ids: [],
      read:          false,
      status:        "pending",
      reference_id:  data.invoiceId,
    });

    await supabaseAdmin.from("notifications" as any)
      .update({ status: "accepted", read: true })
      .eq("reference_id", data.invoiceId)
      .eq("recipient_id", context.userId)
      .eq("type", "invoice_paid");

    return { ok: true };
  });

export const getManagerInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("invoices" as any)
      .select("id,invoice_number,office_name,date_from,date_to,total,status,agency_user_id,created_at")
      .eq("manager_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });
