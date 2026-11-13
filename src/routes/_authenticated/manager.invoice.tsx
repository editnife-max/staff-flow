import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useEffect } from "react";
import {
  Building2, Printer, Search, Users, Send, Download,
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Eye, Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getAgencyUsers,
  sendInvoice,
  getManagerInvoices,
  managerMarkInvoicePaid,
} from "@/lib/invoice.functions";
import { listCustomCvTemplates } from "@/lib/custom-cv.functions";
import {
  invoiceTemplateOptions,
  type InvoiceData,
  type InvoiceTemplateOption,
} from "@/components/invoice-layouts/data";
import { InvoiceDocument, invoiceWebFont } from "@/components/invoice-layouts/templates";
import { printInvoice } from "@/components/invoice-layouts/print";

export const Route = createFileRoute("/_authenticated/manager/invoice")({
  head: () => ({ meta: [{ title: "Invoice — Staff-Flow" }] }),
  component: ManagerInvoicePage,
});

type Candidate = {
  id: string;
  full_name: string;
  passport_number: string | null;
  occupation: string | null;
  ticket_date: string | null;
  selected_by: string | null;
};

type CompanyGroup = { name: string; candidates: Candidate[] };

type InvRecord = {
  id: string;
  invoice_number: string;
  company_name: string | null;
  office_name: string | null;
  date_from: string | null;
  date_to: string | null;
  total: number | null;
  status: string;
  agency_user_id: string | null;
  candidate_ids: string[] | null;
  deduction_amount: number | null;
  deduction_reason: string | null;
  created_at: string;
};

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    sent:      "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
    paid:      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  };
  return (
    <span className={cn("text-[10px] font-semibold rounded-full px-2 py-0.5 capitalize", cls[status] ?? "bg-muted text-muted-foreground")}>
      {status}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayIso() { return new Date().toISOString().split("T")[0]; }
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
/** Per-browser memory of the last invoice template and currency (a convenience only). */
function readPref(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writePref(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage blocked: nothing to remember */ }
}
const TEMPLATE_PREF = "invoice-template";
const CURRENCY_PREF = "invoice-currency";

const TEMPLATE_GROUPS: Array<{ id: InvoiceTemplateOption["group"]; label: string }> = [
  { id: "builtin",  label: "General" },
  { id: "company",  label: "Matches your CV templates" },
  { id: "custom",   label: "Your Custom CV templates" },
];

function TemplatePicker({
  options, value, onChange, className,
}: {
  options: InvoiceTemplateOption[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-8 text-xs", className)}>
        <SelectValue placeholder="Invoice template…" />
      </SelectTrigger>
      <SelectContent>
        {TEMPLATE_GROUPS.map(g => {
          const items = options.filter(o => o.group === g.id);
          if (!items.length) return null;
          return (
            <SelectGroup key={g.id}>
              <SelectLabel className="text-[10px] uppercase tracking-wider">{g.label}</SelectLabel>
              {items.map(o => (
                <SelectItem key={o.id} value={o.id} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function makeInvNum() {
  const d = new Date();
  return `INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────
function ManagerInvoicePage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"unsent" | "sent" | "paid" | "overall">("unsent");
  const [search, setSearch] = useState("");

  // ── Invoice creation state ────────────────────────────────────────────────
  const [activeGroup, setActiveGroup] = useState<CompanyGroup | null>(null);
  const [invNum, setInvNum] = useState(makeInvNum);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [templateId, setTemplateId] = useState("standard");
  const [currency, setCurrency] = useState("");
  // Read after mount: the page is server-rendered, where there is no localStorage.
  useEffect(() => {
    setTemplateId(readPref(TEMPLATE_PREF, "standard"));
    setCurrency(readPref(CURRENCY_PREF, ""));
  }, []);
  const chooseTemplate = (v: string) => { setTemplateId(v); writePref(TEMPLATE_PREF, v); };
  const chooseCurrency = (v: string) => { setCurrency(v); writePref(CURRENCY_PREF, v); };

  const [fromCompany,    setFromCompany]    = useState("");
  const [fromAddress,    setFromAddress]    = useState("");
  const [fromPhone,      setFromPhone]      = useState("");
  const [fromEmail,      setFromEmail]      = useState(user?.email ?? "");
  const [recruFee,       setRecruFee]       = useState("");
  const [paymentName,    setPaymentName]    = useState("");
  const [paymentAccount, setPaymentAccount] = useState("");
  const [officeName,     setOfficeName]     = useState("");
  const [term,           setTerm]           = useState("");
  const [invoiceDate,    setInvoiceDate]    = useState(todayIso());
  const [dueDate,        setDueDate]        = useState("");
  const [dateFrom,       setDateFrom]       = useState("");
  const [dateTo,         setDateTo]         = useState("");
  const [otherExpenses,  setOtherExpenses]  = useState("");
  const [agencyUserId,   setAgencyUserId]   = useState("");

  // ── Pay-dialog state ──────────────────────────────────────────────────────
  const [payDialog, setPayDialog]         = useState<InvRecord | null>(null);
  const [deductAmt, setDeductAmt]         = useState("");
  const [deductReason, setDeductReason]   = useState("");

  // ── Overall accordion ─────────────────────────────────────────────────────
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  // ── Server fns ────────────────────────────────────────────────────────────
  const doGetAgencies = useServerFn(getAgencyUsers);
  const doSend        = useServerFn(sendInvoice);
  const doGetHistory  = useServerFn(getManagerInvoices);
  const doMarkPaid    = useServerFn(managerMarkInvoicePaid);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: candidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ["invoice-candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("id,full_name,passport_number,occupation,ticket_date,selected_by")
        .eq("status", "arrived")
        .order("full_name", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return data as unknown as Candidate[];
    },
    enabled: !!user,
  });

  const { data: agencyUsers = [] } = useQuery<{ user_id: string; name: string }[]>({
    queryKey: ["agency-users"],
    queryFn: () => doGetAgencies(),
    enabled: !!user,
  });

  // Invoice templates follow the company's CV designs.
  const { data: cvTemplates = [] } = useQuery<{ name: string }[]>({
    queryKey: ["invoice-cv-template-names", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cv_templates").select("name");
      if (error) throw error;
      return (data ?? []) as { name: string }[];
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
  const doListCustom = useServerFn(listCustomCvTemplates);
  const { data: customData } = useQuery({
    queryKey: ["custom-cv-templates"],
    queryFn: () => doListCustom(),
    enabled: !!user,
    staleTime: 60_000,
  });
  const templateOptions = useMemo(
    () => invoiceTemplateOptions(cvTemplates, customData?.templates ?? []),
    [cvTemplates, customData],
  );
  // A remembered template that no longer exists falls back to the default.
  const template = templateOptions.find(o => o.id === templateId) ?? templateOptions[0];

  const { data: invoiceHistory = [] } = useQuery<InvRecord[]>({
    queryKey: ["manager-invoices"],
    queryFn: () => doGetHistory() as Promise<InvRecord[]>,
    enabled: !!user,
  });

  // ── Derived data ──────────────────────────────────────────────────────────
  const companyGroups = useMemo<CompanyGroup[]>(() => {
    const invoicedIds = new Set(invoiceHistory.flatMap(inv => inv.candidate_ids ?? []));
    const uninvoiced = candidates.filter(c => !invoicedIds.has(c.id));
    const map = new Map<string, Candidate[]>();
    for (const c of uninvoiced) {
      const key = c.selected_by?.trim() || "— Unassigned —";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries())
      .map(([name, cands]) => ({ name, candidates: cands }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [candidates, invoiceHistory]);

  const sentInvoices  = useMemo(() => invoiceHistory.filter(i => i.status === "sent"), [invoiceHistory]);
  const paidInvoices  = useMemo(() => invoiceHistory.filter(i => i.status === "paid" || i.status === "confirmed"), [invoiceHistory]);

  const overallByCompany = useMemo(() => {
    const map = new Map<string, InvRecord[]>();
    for (const inv of invoiceHistory) {
      const key = inv.company_name ?? inv.office_name ?? "— Unknown —";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(inv);
    }
    return Array.from(map.entries())
      .map(([company, invs]) => ({
        company,
        invoices: [...invs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
        totalInvoiced:    invs.reduce((s, i) => s + (i.total ?? 0), 0),
        totalDeductions:  invs.reduce((s, i) => s + (i.deduction_amount ?? 0), 0),
        netReceived:      invs.reduce((s, i) => s + (i.total ?? 0) - (i.deduction_amount ?? 0), 0),
      }))
      .sort((a, b) => a.company.localeCompare(b.company));
  }, [invoiceHistory]);

  const filteredGroups = companyGroups.filter(g =>
    !search || g.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Computations for active invoice ──────────────────────────────────────
  const workers  = activeGroup?.candidates ?? [];
  const feeEach  = parseFloat(recruFee || "0") || 0;
  const subtotal = feeEach * workers.length;
  const other    = parseFloat(otherExpenses || "0") || 0;
  const total    = subtotal + other;
  const missingFields = workers.filter(c => !c.occupation || !c.ticket_date);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const sendMut = useMutation({
    mutationFn: () =>
      doSend({
        data: {
          agencyUserId:   agencyUserId || undefined,
          invoiceNumber:  invNum,
          companyName:    activeGroup?.name !== "— Unassigned —" ? activeGroup?.name : undefined,
          officeName:     officeName  || undefined,
          dateFrom:       dateFrom    || undefined,
          dateTo:         dateTo      || undefined,
          candidateIds:   workers.map(c => c.id),
          fromCompany:    fromCompany || undefined,
          fromAddress:    fromAddress || undefined,
          fromPhone:      fromPhone   || undefined,
          fromEmail:      fromEmail   || undefined,
          paymentName:    paymentName    || undefined,
          paymentAccount: paymentAccount || undefined,
          recruFee:       feeEach,
          otherExpenses:  other,
          subtotal,
          total,
        },
      }),
    onSuccess: () => {
      toast.success("Invoice saved and sent");
      qc.invalidateQueries({ queryKey: ["manager-invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice-candidates"] });
      setActiveGroup(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaidMut = useMutation({
    mutationFn: () =>
      doMarkPaid({
        data: {
          invoiceId:       payDialog!.id,
          deductionAmount: parseFloat(deductAmt || "0") || 0,
          deductionReason: deductReason || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Invoice marked as paid");
      qc.invalidateQueries({ queryKey: ["manager-invoices"] });
      setPayDialog(null);
      setDeductAmt(""); setDeductReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Print handler ─────────────────────────────────────────────────────────
  const invoiceData: InvoiceData = {
    number: invNum,
    date: invoiceDate,
    dueDate,
    periodFrom: dateFrom,
    periodTo: dateTo,
    from: { company: fromCompany, address: fromAddress, phone: fromPhone, email: fromEmail },
    company: activeGroup && activeGroup.name !== "— Unassigned —" ? activeGroup.name : "",
    billTo: officeName,
    payment: { name: paymentName, account: paymentAccount },
    terms: term,
    currency: currency.trim(),
    workers: workers.map(c => ({
      id: c.id,
      name: c.full_name,
      passport: c.passport_number,
      travelDate: c.ticket_date,
      profession: c.occupation,
    })),
    feeEach,
    subtotal,
    otherExpenses: other,
    total,
  };

  /** Opens the print dialog; false when the browser blocked the print window. */
  function handlePrint(): boolean {
    const ok = printInvoice(<InvoiceDocument template={template} data={invoiceData} />, {
      title: invNum,
      webFont: invoiceWebFont(template),
    });
    if (!ok) toast.error("Your browser blocked the print window. Allow pop-ups for this site and try again.");
    return ok;
  }

  // ── Excel export ──────────────────────────────────────────────────────────
  async function downloadOverallExcel() {
    const XLSX = await import("xlsx-js-style");
    const headers = ["Company", "Invoice #", "Date Sent", "Status", "Workers", "Total", "Deduction", "Net Received", "Deduction Reason"];
    const rows: (string | number)[][] = [];
    for (const { company, invoices } of overallByCompany) {
      for (const inv of invoices) {
        rows.push([
          company,
          inv.invoice_number,
          inv.created_at ? fmtDate(inv.created_at) : "—",
          inv.status,
          (inv.candidate_ids ?? []).length,
          inv.total ?? 0,
          inv.deduction_amount ?? 0,
          (inv.total ?? 0) - (inv.deduction_amount ?? 0),
          inv.deduction_reason ?? "",
        ]);
      }
    }
    const ws = (XLSX as any).utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [22, 16, 14, 10, 10, 12, 12, 14, 28].map(wch => ({ wch }));
    const wb = (XLSX as any).utils.book_new();
    (XLSX as any).utils.book_append_sheet(wb, ws, "Invoices");
    const buf = (XLSX as any).write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "invoices-overall.xlsx"; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Pay-dialog deduction live calc ────────────────────────────────────────
  const payDeduct = parseFloat(deductAmt || "0") || 0;
  const payNet    = (payDialog?.total ?? 0) - payDeduct;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 space-y-4">

      {/* ── Page title ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-[28px]">Invoice</h1>
        <p className="text-sm text-muted-foreground">
          {companyGroups.length} compan{companyGroups.length !== 1 ? "ies" : "y"} · {candidates.length} arrived workers
        </p>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="flex border-b">
        {(["unsent", "sent", "paid", "overall"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "px-5 py-2 text-sm font-medium border-b-2 transition-colors capitalize",
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}>
            {t}
            {t === "unsent" && companyGroups.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                {companyGroups.length}
              </span>
            )}
            {t === "sent" && sentInvoices.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-yellow-500/15 text-yellow-700 px-1.5 py-0.5 rounded-full">
                {sentInvoices.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          TAB: UNSENT
      ════════════════════════════════════════════════════════════════════ */}
      {tab === "unsent" && (
        <div className="space-y-4">

          {/* Settings bar */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Invoice From (your details)</p>
                <div className="flex flex-wrap gap-3">
                  <div className="space-y-1 flex-1 min-w-[160px]">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Company / Agency Name</Label>
                    <Input placeholder="Staff-Flow Agency" value={fromCompany} onChange={e => setFromCompany(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1 flex-1 min-w-[160px]">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Address</Label>
                    <Input placeholder="123 Main St, City" value={fromAddress} onChange={e => setFromAddress(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1 min-w-[140px]">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Office Number</Label>
                    <Input placeholder="+1 234 567 890" value={fromPhone} onChange={e => setFromPhone(e.target.value)} className="h-8 text-sm w-44" />
                  </div>
                  <div className="space-y-1 flex-1 min-w-[160px]">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</Label>
                    <Input type="email" placeholder="office@example.com" value={fromEmail} onChange={e => setFromEmail(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
              </div>
              <div className="border-t pt-3 flex flex-wrap items-end gap-5">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recru. Fee <span className="normal-case font-normal">(per worker)</span></Label>
                  <input type="number" min={0} placeholder="0" value={recruFee}
                    onChange={e => setRecruFee(e.target.value)}
                    className="h-8 w-36 rounded border border-border bg-muted/40 px-3 text-sm outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment Name</Label>
                  <Input placeholder="e.g. Bank Transfer" value={paymentName} onChange={e => setPaymentName(e.target.value)} className="h-8 w-44 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Account Number</Label>
                  <Input placeholder="e.g. 1234 5678 9012" value={paymentAccount} onChange={e => setPaymentAccount(e.target.value)} className="h-8 w-44 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Currency</Label>
                  <Input placeholder="e.g. SAR" value={currency} onChange={e => chooseCurrency(e.target.value)} maxLength={8} className="h-8 w-24 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Invoice Template</Label>
                  <TemplatePicker options={templateOptions} value={template?.id ?? "standard"} onChange={chooseTemplate} className="w-56" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search company…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
          </div>

          {/* Company cards */}
          {isLoading ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
          ) : filteredGroups.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No uninvoiced arrived workers.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredGroups.map(g => (
                <Card key={g.name} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="h-10 w-10 rounded-md bg-primary/10 grid place-items-center shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" title={g.name}>{g.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {g.candidates.length} worker{g.candidates.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 self-center" onClick={() => {
                      setActiveGroup(g);
                      setInvNum(makeInvNum());
                      setView("edit");
                      setOfficeName(g.name === "— Unassigned —" ? "" : g.name);
                      setOtherExpenses(""); setDateFrom(""); setDateTo("");
                    }}>
                      Invoice
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB: SENT
      ════════════════════════════════════════════════════════════════════ */}
      {tab === "sent" && (
        <div>
          {sentInvoices.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No sent invoices yet.</CardContent></Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invoice #</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date Sent</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Workers</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sentInvoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{inv.company_name ?? inv.office_name ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(inv.created_at)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{(inv.candidate_ids ?? []).length}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">{Number(inv.total ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => { setPayDialog(inv); setDeductAmt(""); setDeductReason(""); }}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Paid
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB: PAID
      ════════════════════════════════════════════════════════════════════ */}
      {tab === "paid" && (
        <div>
          {paidInvoices.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No paid invoices yet.</CardContent></Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invoice #</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deduction</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reason</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Net Received</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paidInvoices.map(inv => {
                      const deduct = inv.deduction_amount ?? 0;
                      const net = (inv.total ?? 0) - deduct;
                      return (
                        <tr key={inv.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{inv.company_name ?? inv.office_name ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(inv.created_at)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{Number(inv.total ?? 0).toLocaleString()}</td>
                          <td className={cn("px-4 py-3 text-right tabular-nums", deduct > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground")}>
                            {deduct > 0 ? `−${deduct.toLocaleString()}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px] truncate" title={inv.deduction_reason ?? ""}>
                            {inv.deduction_reason || "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                            {net.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center"><StatusBadge status={inv.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB: OVERALL
      ════════════════════════════════════════════════════════════════════ */}
      {tab === "overall" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{invoiceHistory.length} total invoice{invoiceHistory.length !== 1 ? "s" : ""} across {overallByCompany.length} compan{overallByCompany.length !== 1 ? "ies" : "y"}</p>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={downloadOverallExcel}>
              <Download className="h-3 w-3" /> Download Excel
            </Button>
          </div>

          {overallByCompany.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No invoices yet.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {overallByCompany.map(({ company, invoices, totalInvoiced, totalDeductions, netReceived }) => {
                const isOpen = expandedCompany === company;
                return (
                  <div key={company} className="border border-border bg-background">
                    {/* Company header */}
                    <button type="button"
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                      onClick={() => setExpandedCompany(isOpen ? null : company)}>
                      <Building2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="flex-1 font-semibold text-sm">{company}</span>
                      <span className="text-xs text-muted-foreground">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</span>
                      <div className="flex items-center gap-4 text-xs tabular-nums">
                        <span className="text-muted-foreground">Invoiced: <strong className="text-foreground">{totalInvoiced.toLocaleString()}</strong></span>
                        {totalDeductions > 0 && (
                          <span className="text-amber-600 dark:text-amber-400">Deductions: <strong>−{totalDeductions.toLocaleString()}</strong></span>
                        )}
                        <span className="text-emerald-700 dark:text-emerald-400">Net: <strong>{netReceived.toLocaleString()}</strong></span>
                      </div>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </button>

                    {/* Invoice rows */}
                    {isOpen && (
                      <div className="border-t border-border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-muted/40 border-b">
                              <th className="text-left px-4 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Invoice #</th>
                              <th className="text-left px-4 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                              <th className="text-right px-4 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Workers</th>
                              <th className="text-right px-4 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                              <th className="text-right px-4 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Deduction</th>
                              <th className="text-right px-4 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Net</th>
                              <th className="text-center px-4 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {invoices.map(inv => {
                              const deduct = inv.deduction_amount ?? 0;
                              return (
                                <tr key={inv.id} className="hover:bg-muted/20">
                                  <td className="px-4 py-2 font-mono">{inv.invoice_number}</td>
                                  <td className="px-4 py-2 text-muted-foreground">{fmtDate(inv.created_at)}</td>
                                  <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">{(inv.candidate_ids ?? []).length}</td>
                                  <td className="px-4 py-2 text-right tabular-nums">{Number(inv.total ?? 0).toLocaleString()}</td>
                                  <td className={cn("px-4 py-2 text-right tabular-nums", deduct > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                                    {deduct > 0 ? `−${deduct.toLocaleString()}` : "—"}
                                  </td>
                                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                                    {((inv.total ?? 0) - deduct).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-2 text-center"><StatusBadge status={inv.status} /></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          INVOICE CREATION DIALOG
      ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!activeGroup} onOpenChange={o => { if (!o) setActiveGroup(null); }}>
        <DialogContent className="max-w-5xl p-0 gap-0 max-h-[95vh] flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b shrink-0 gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold font-mono">{invNum}</span>
              {activeGroup && (
                <span className="text-xs text-muted-foreground truncate">· {activeGroup.name}</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex border border-border" role="group" aria-label="Edit or preview the invoice">
                {([["edit", "Edit", Pencil], ["preview", "Preview", Eye]] as const).map(([v, label, Icon]) => (
                  <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                    className={cn("flex items-center gap-1 px-2.5 h-8 text-xs font-medium transition-colors",
                      view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
              <TemplatePicker options={templateOptions} value={template?.id ?? "standard"} onChange={chooseTemplate} className="w-48" />
              {agencyUsers.length > 0 && (
                <Select value={agencyUserId} onValueChange={setAgencyUserId}>
                  <SelectTrigger className="h-8 w-48 text-xs">
                    <SelectValue placeholder="Select agency (optional)…" />
                  </SelectTrigger>
                  <SelectContent>
                    {agencyUsers.map(a => (
                      <SelectItem key={a.user_id} value={a.user_id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={sendMut.isPending}
                onClick={() => { if (handlePrint()) sendMut.mutate(); }}>
                <Send className="h-3.5 w-3.5" />
                {sendMut.isPending ? "Saving…" : "Print & Send"}
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handlePrint}>
                <Printer className="h-3.5 w-3.5" /> Print Only
              </Button>
            </div>
          </div>

          {view === "preview" && (
            <div className="overflow-auto flex-1 bg-muted/40 p-6">
              <div className="mx-auto bg-white shadow-sm" style={{ width: 794, padding: "28px 34px" }}>
                <InvoiceDocument template={template} data={invoiceData} />
              </div>
            </div>
          )}

          <div className={cn("overflow-y-auto flex-1 p-6", view === "preview" && "hidden")}>

            {/* Missing fields warning */}
            {missingFields.length > 0 && (
              <div className="mb-4 flex items-start gap-2 px-3 py-2.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/40 rounded text-xs text-yellow-800 dark:text-yellow-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-yellow-600" />
                <span>
                  <strong>{missingFields.length} worker{missingFields.length !== 1 ? "s" : ""}</strong> missing occupation or travel date — required fields marked in red below.
                </span>
              </div>
            )}

            {/* Invoice header */}
            <div className="flex items-start justify-between border-b-2 border-[#1a3a52] pb-4 mb-6">
              <div>
                <div className="text-xl font-bold text-[#1a3a52]">Staff-Flow</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Recruitment &amp; Placement Agency</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-[#1a3a52] tracking-wide">INVOICE</div>
                <div className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium">No:</span> {invNum}
                </div>
              </div>
            </div>

            {/* Two-column body */}
            <div className="flex gap-8 items-start">

              {/* LEFT */}
              <div className="w-52 shrink-0 flex flex-col gap-4">
                <div className="space-y-1 pb-3 border-b">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Invoice From</p>
                  <div className="space-y-1.5 text-sm">
                    <Input placeholder="Company / Agency name" value={fromCompany} onChange={e => setFromCompany(e.target.value)} className="h-7 text-xs" />
                    <Input placeholder="Address" value={fromAddress} onChange={e => setFromAddress(e.target.value)} className="h-7 text-xs" />
                    <Input placeholder="Office number" value={fromPhone} onChange={e => setFromPhone(e.target.value)} className="h-7 text-xs" />
                    <Input type="email" placeholder="Email" value={fromEmail} onChange={e => setFromEmail(e.target.value)} className="h-7 text-xs" />
                  </div>
                </div>

                {activeGroup?.name && activeGroup.name !== "— Unassigned —" && (
                  <div className="space-y-0.5 pb-3 border-b">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Company / Sponsor</p>
                    <p className="text-sm font-semibold text-[#1a3a52]">{activeGroup.name}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bill To / Office</Label>
                  <Textarea rows={2} placeholder="Office name & address…" value={officeName} onChange={e => setOfficeName(e.target.value)} className="text-sm resize-none" />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment Name</Label>
                  <Input placeholder="e.g. Bank Transfer" value={paymentName} onChange={e => setPaymentName(e.target.value)} className="text-sm h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Account Number</Label>
                  <Input placeholder="e.g. 1234 5678 9012" value={paymentAccount} onChange={e => setPaymentAccount(e.target.value)} className="text-sm h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Terms</Label>
                  <Input placeholder="e.g. Net 30" value={term} onChange={e => setTerm(e.target.value)} className="text-sm h-8" />
                </div>

                <div className="mt-auto pt-6 text-sm font-bold text-[#1a3a52] leading-snug">
                  THANK YOU FOR<br />YOUR BUSINESS
                </div>
              </div>

              {/* RIGHT */}
              <div className="flex-1 min-w-0 flex flex-col gap-4">
                {/* Dates row */}
                <div className="flex gap-4 flex-wrap">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Invoice Date</Label>
                    <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="text-sm h-8 w-40" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Due Date</Label>
                    <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="text-sm h-8 w-40" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Period From</Label>
                    <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-sm h-8 w-40" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Period To</Label>
                    <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-sm h-8 w-40" />
                  </div>
                </div>

                {/* Workers table */}
                <div className="overflow-x-auto border rounded">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#1a3a52] text-white text-xs">
                        <th className="px-3 py-2 text-center w-10">#</th>
                        <th className="px-3 py-2 text-left">Worker Name</th>
                        <th className="px-3 py-2 text-left">Passport No.</th>
                        <th className="px-3 py-2 text-left">Travel Date <span className="text-red-300">*</span></th>
                        <th className="px-3 py-2 text-left">Profession <span className="text-red-300">*</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {workers.map((c, i) => (
                        <tr key={c.id} className={cn("border-b border-border/50", i % 2 !== 0 && "bg-muted/10")}>
                          <td className="px-3 py-1.5 text-center text-muted-foreground text-xs">{i + 1}</td>
                          <td className="px-3 py-1.5 font-medium whitespace-nowrap">{c.full_name}</td>
                          <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{c.passport_number ?? "—"}</td>
                          <td className={cn("px-3 py-1.5 whitespace-nowrap", !c.ticket_date ? "text-red-500 font-medium" : "text-muted-foreground")}>
                            {c.ticket_date ? fmtDate(c.ticket_date) : "⚠ Missing"}
                          </td>
                          <td className={cn("px-3 py-1.5 whitespace-nowrap", !c.occupation ? "text-red-500 font-medium" : "text-muted-foreground")}>
                            {c.occupation ?? "⚠ Missing"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="ml-auto w-72 space-y-1.5 text-sm">
                  <div className="flex items-center justify-between border-b pb-1.5 gap-3">
                    <span className="text-muted-foreground shrink-0">Recru. Fee <span className="text-xs">(× {workers.length})</span></span>
                    <input type="number" min={0} placeholder="0" value={recruFee}
                      onChange={e => setRecruFee(e.target.value)}
                      className="w-28 text-right bg-muted/40 border border-border rounded px-2 py-0.5 text-sm outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-1.5 gap-3">
                    <span className="text-muted-foreground shrink-0">Other Expenses</span>
                    <input type="number" min={0} placeholder="0" value={otherExpenses}
                      onChange={e => setOtherExpenses(e.target.value)}
                      className="w-28 text-right bg-muted/40 border border-border rounded px-2 py-0.5 text-sm outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="font-bold text-[#1a3a52] text-base">Total Due</span>
                    <span className="font-bold text-[#1a3a52] text-base">{total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════════
          MARK PAID DIALOG
      ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!payDialog} onOpenChange={o => { if (!o) setPayDialog(null); }}>
        <DialogContent className="max-w-sm p-0 gap-0">
          <div className="px-5 py-3 border-b">
            <h2 className="text-sm font-semibold">Mark Invoice as Paid</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{payDialog?.invoice_number} · {payDialog?.company_name ?? payDialog?.office_name ?? "—"}</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Invoice Total</span>
              <span className="font-semibold">{Number(payDialog?.total ?? 0).toLocaleString()}</span>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deduction Amount <span className="normal-case font-normal">(optional)</span></Label>
              <input type="number" min={0} placeholder="0" value={deductAmt}
                onChange={e => setDeductAmt(e.target.value)}
                className="w-full h-8 rounded border border-border bg-muted/40 px-3 text-sm outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reason <span className="normal-case font-normal">(optional)</span></Label>
              <Textarea rows={2} placeholder="e.g. Late penalty, quality deduction…" value={deductReason}
                onChange={e => setDeductReason(e.target.value)} className="text-sm resize-none" />
            </div>
            <div className="flex items-center justify-between pt-1 border-t text-sm">
              <span className="text-muted-foreground">Net Received</span>
              <span className={cn("font-bold text-base", payDeduct > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
                {payNet.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="px-5 pb-5 flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setPayDialog(null)}>Cancel</Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={markPaidMut.isPending} onClick={() => markPaidMut.mutate()}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              {markPaidMut.isPending ? "Saving…" : "Confirm Paid"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
