import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Building2, Printer, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
  cv_sent_to: string | null;
};

type OfficeGroup = {
  name: string;
  candidates: Candidate[];
};

function ManagerInvoicePage() {
  const { user } = useAuth();
  const [search, setSearch]       = useState("");
  const [activeOffice, setActiveOffice] = useState<OfficeGroup | null>(null);

  // ── "From" details (set once, apply to all invoices) ──────────────────────
  const [fromCompany, setFromCompany] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [fromPhone,   setFromPhone]   = useState("");
  const [fromEmail,   setFromEmail]   = useState(user?.email ?? "");

  // ── Invoice defaults (set once, apply to all invoices) ───────────────────
  const [recruFee,       setRecruFee]       = useState("");
  const [paymentName,    setPaymentName]    = useState("");
  const [paymentAccount, setPaymentAccount] = useState("");

  // ── Per-invoice fields (reset per dialog open where needed) ──────────────
  const [officeName,    setOfficeName]    = useState("");
  const [term,          setTerm]          = useState("");
  const [invoiceDate,   setInvoiceDate]   = useState(todayIso());
  const [dueDate,       setDueDate]       = useState("");
  const [otherExpenses, setOtherExpenses] = useState("");

  const { data: candidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ["invoice-candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("id,full_name,passport_number,occupation,ticket_date,cv_sent_to")
        .eq("status", "arrived")
        .order("full_name", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return data as unknown as Candidate[];
    },
    enabled: !!user,
  });

  const officeGroups: OfficeGroup[] = useMemo(() => {
    const map = new Map<string, Candidate[]>();
    for (const c of candidates) {
      const key = c.cv_sent_to?.trim() || "— Unassigned —";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries())
      .map(([name, cands]) => ({ name, candidates: cands.slice(0, 200) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [candidates]);

  const filtered = officeGroups.filter((g) =>
    !search || g.name.toLowerCase().includes(search.toLowerCase())
  );

  function openInvoice(group: OfficeGroup) {
    setActiveOffice(group);
    setOfficeName(group.name === "— Unassigned —" ? "" : group.name);
    setOtherExpenses("");
  }

  function closeInvoice() { setActiveOffice(null); }

  const invoiceNum = useMemo(() => {
    const d = new Date();
    return `INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOffice?.name]);

  const workers  = activeOffice?.candidates ?? [];
  const feeEach  = parseFloat(recruFee || "0") || 0;
  const subtotal = feeEach * workers.length;
  const other    = parseFloat(otherExpenses || "0") || 0;
  const total    = subtotal + other;

  function handlePrint() {
    const rows = workers.map((c, i) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;color:#666">${i + 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:600">${c.full_name}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#555">${c.passport_number ?? "—"}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#555">${c.ticket_date ? fmtDate(c.ticket_date) : "—"}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#555">${c.occupation ?? "—"}</td>
      </tr>`).join("");

    const fromBlock = [
      fromCompany && `<div style="font-weight:700;font-size:13px;color:#1a3a52">${fromCompany}</div>`,
      fromAddress && `<div>${fromAddress}</div>`,
      fromPhone   && `<div>Tel: ${fromPhone}</div>`,
      fromEmail   && `<div>${fromEmail}</div>`,
    ].filter(Boolean).join("");

    const win = window.open("", "_blank", "width=1000,height=750");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${invoiceNum}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;padding:28px 36px;color:#111;font-size:12px}
      .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #1a3a52;padding-bottom:14px;margin-bottom:18px}
      .logo{font-size:20px;font-weight:700;color:#1a3a52}.logo-sub{font-size:10px;color:#888;margin-top:2px}
      .inv-h{font-size:26px;font-weight:700;color:#1a3a52;text-align:right}
      .inv-meta{font-size:11px;color:#555;text-align:right;margin-top:4px;line-height:1.8}
      .body{display:flex;gap:28px;align-items:flex-start}
      .left{width:200px;flex-shrink:0;display:flex;flex-direction:column;gap:14px}
      .right{flex:1;min-width:0}
      .lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#999;margin-bottom:4px}
      .val{font-size:12px;color:#111;line-height:1.6;word-break:break-word}
      .divider{border-top:1px solid #e5e7eb;margin:4px 0}
      .thank{margin-top:auto;padding-top:20px;font-size:13px;font-weight:700;color:#1a3a52;line-height:1.5}
      table{width:100%;border-collapse:collapse}
      th{background:#1a3a52;color:#fff;padding:7px 8px;font-size:10px;text-align:left;white-space:nowrap}
      th:first-child{text-align:center;width:34px}
      td{vertical-align:middle;padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px}
      .totals{margin-top:10px;margin-left:auto;width:260px}
      .t-row{display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid #e5e7eb}
      .t-row.final{font-weight:700;font-size:14px;color:#1a3a52;border:none;padding-top:8px}
      @media print{body{padding:14px 20px}@page{margin:1cm}}
    </style></head><body>
    <div class="top">
      <div><div class="logo">Staff-Flow</div><div class="logo-sub">Recruitment &amp; Placement Agency</div></div>
      <div>
        <div class="inv-h">INVOICE</div>
        <div class="inv-meta">
          <div><b>No:</b> ${invoiceNum}</div>
          <div><b>Date:</b> ${invoiceDate ? fmtDate(invoiceDate) : "—"}</div>
          ${dueDate ? `<div><b>Due:</b> ${fmtDate(dueDate)}</div>` : ""}
        </div>
      </div>
    </div>
    <div class="body">
      <div class="left">
        ${fromBlock ? `<div><div class="lbl">Invoice From</div><div class="val">${fromBlock}</div></div><div class="divider"></div>` : ""}
        ${officeName ? `<div><div class="lbl">Bill To / Office</div><div class="val">${officeName}</div></div>` : ""}
        ${(paymentName || paymentAccount) ? `<div><div class="lbl">Payment</div><div class="val">${paymentName ? `<div style="font-weight:600">${paymentName}</div>` : ""}${paymentAccount ? `<div>Acc: ${paymentAccount}</div>` : ""}</div></div>` : ""}
        ${term       ? `<div><div class="lbl">Terms</div><div class="val">${term}</div></div>` : ""}
        <div class="thank">THANK YOU FOR<br>YOUR BUSINESS</div>
      </div>
      <div class="right">
        <table>
          <thead><tr>
            <th>#</th><th>Worker Name</th><th>Passport No.</th>
            <th>Travel Date</th><th>Profession</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totals">
          <div class="t-row"><span>Recru. Fee (×${workers.length})</span><span>${feeEach.toLocaleString()} × ${workers.length} = ${subtotal.toLocaleString()}</span></div>
          <div class="t-row"><span>Other Expenses</span><span>${other.toLocaleString()}</span></div>
          <div class="t-row final"><span>Total Due</span><span>${total.toLocaleString()}</span></div>
        </div>
      </div>
    </div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  return (
    <div>
      <PageHeader
        title="Invoice"
        description={`${officeGroups.length} office${officeGroups.length !== 1 ? "s" : ""} · ${candidates.length} arrived worker${candidates.length !== 1 ? "s" : ""}`}
      />

      {/* ── Settings bar ─────────────────────────────────────────────────── */}
      <Card className="rounded-none mb-5">
        <CardContent className="p-4 space-y-4">
          {/* From details */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Invoice From (your details)</p>
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1 flex-1 min-w-[160px]">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Company / Agency Name</Label>
                <Input placeholder="Staff-Flow Agency" value={fromCompany} onChange={(e) => setFromCompany(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1 flex-1 min-w-[160px]">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Address</Label>
                <Input placeholder="123 Main St, City" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1 min-w-[140px]">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Office Number</Label>
                <Input placeholder="+1 234 567 890" value={fromPhone} onChange={(e) => setFromPhone(e.target.value)} className="h-8 text-sm w-44" />
              </div>
              <div className="space-y-1 flex-1 min-w-[160px]">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</Label>
                <Input type="email" placeholder="office@example.com" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
          </div>

          {/* Invoice defaults */}
          <div className="border-t pt-3 flex flex-wrap items-end gap-5">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Recru. Fee <span className="normal-case font-normal">(per worker)</span>
              </Label>
              <input
                type="number" min={0} placeholder="0" value={recruFee}
                onChange={(e) => setRecruFee(e.target.value)}
                className="h-8 w-36 rounded border border-border bg-muted/40 px-3 text-sm outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment Name</Label>
              <Input placeholder="e.g. Bank Transfer" value={paymentName} onChange={(e) => setPaymentName(e.target.value)} className="h-8 w-44 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Account Number</Label>
              <Input placeholder="e.g. 1234 5678 9012" value={paymentAccount} onChange={(e) => setPaymentAccount(e.target.value)} className="h-8 w-44 text-sm" />
            </div>
            <p className="text-xs text-muted-foreground pb-1">All fields above apply to every invoice — still editable per invoice.</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Search ───────────────────────────────────────────────────────── */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search office…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
      </div>

      {/* ── Office cards ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <Card className="rounded-none"><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card className="rounded-none"><CardContent className="p-8 text-center text-sm text-muted-foreground">No arrived candidates found.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((g) => (
            <Card key={g.name} className="rounded-none hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="h-10 w-10 rounded-md bg-primary/10 grid place-items-center shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" title={g.name}>{g.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {g.candidates.length} worker{g.candidates.length !== 1 ? "s" : ""}
                    {g.candidates.length === 200 && <span className="text-[10px] text-orange-500 ml-1">(max 200)</span>}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 self-center" onClick={() => openInvoice(g)}>
                  Invoice
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Invoice dialog ───────────────────────────────────────────────── */}
      <Dialog open={!!activeOffice} onOpenChange={(o) => { if (!o) closeInvoice(); }}>
        <DialogContent className="max-w-5xl p-0 gap-0 max-h-[95vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
            <span className="text-sm font-semibold">{invoiceNum}</span>
            <Button size="sm" className="gap-1.5" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>

          <div className="overflow-y-auto flex-1 p-6">
            {/* Invoice header */}
            <div className="flex items-start justify-between border-b-2 border-[#1a3a52] pb-4 mb-6">
              <div>
                <div className="text-xl font-bold text-[#1a3a52]">Staff-Flow</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Recruitment &amp; Placement Agency</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-[#1a3a52] tracking-wide">INVOICE</div>
                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  <div><span className="font-medium">No:</span> {invoiceNum}</div>
                </div>
              </div>
            </div>

            {/* Two-column body */}
            <div className="flex gap-8 items-start">

              {/* LEFT */}
              <div className="w-52 shrink-0 flex flex-col gap-4">

                {/* Invoice From */}
                <div className="space-y-1 pb-3 border-b">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Invoice From</p>
                  <div className="space-y-1.5 text-sm">
                    <Input placeholder="Company / Agency name" value={fromCompany} onChange={(e) => setFromCompany(e.target.value)} className="h-7 text-xs" />
                    <Input placeholder="Address" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} className="h-7 text-xs" />
                    <Input placeholder="Office number" value={fromPhone} onChange={(e) => setFromPhone(e.target.value)} className="h-7 text-xs" />
                    <Input type="email" placeholder="Email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} className="h-7 text-xs" />
                  </div>
                </div>

                {/* Bill To */}
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bill To / Office Name</Label>
                  <Textarea rows={2} placeholder="Office name & address…" value={officeName} onChange={(e) => setOfficeName(e.target.value)} className="text-sm resize-none" />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment Name</Label>
                  <Input placeholder="e.g. Bank Transfer" value={paymentName} onChange={(e) => setPaymentName(e.target.value)} className="text-sm h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Account Number</Label>
                  <Input placeholder="e.g. 1234 5678 9012" value={paymentAccount} onChange={(e) => setPaymentAccount(e.target.value)} className="text-sm h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Terms</Label>
                  <Input placeholder="e.g. Net 30" value={term} onChange={(e) => setTerm(e.target.value)} className="text-sm h-8" />
                </div>

                <div className="mt-auto pt-6 text-sm font-bold text-[#1a3a52] leading-snug">
                  THANK YOU FOR<br />YOUR BUSINESS
                </div>
              </div>

              {/* RIGHT */}
              <div className="flex-1 min-w-0 flex flex-col gap-4">
                <div className="flex gap-4 flex-wrap">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Invoice Date</Label>
                    <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="text-sm h-8 w-40" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Due Date</Label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="text-sm h-8 w-40" />
                  </div>
                </div>

                <div className="overflow-x-auto border rounded">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#1a3a52] text-white text-xs">
                        <th className="px-3 py-2 text-center w-10">#</th>
                        <th className="px-3 py-2 text-left">Worker Name</th>
                        <th className="px-3 py-2 text-left">Passport No.</th>
                        <th className="px-3 py-2 text-left">Travel Date</th>
                        <th className="px-3 py-2 text-left">Profession</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workers.map((c, i) => (
                        <tr key={c.id} className={cn("border-b border-border/50 hover:bg-muted/30", i % 2 !== 0 && "bg-muted/10")}>
                          <td className="px-3 py-1.5 text-center text-muted-foreground text-xs">{i + 1}</td>
                          <td className="px-3 py-1.5 font-medium whitespace-nowrap">{c.full_name}</td>
                          <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{c.passport_number ?? "—"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{c.ticket_date ? fmtDate(c.ticket_date) : "—"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{c.occupation ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="ml-auto w-72 space-y-1.5 text-sm">
                  <div className="flex items-center justify-between border-b pb-1.5 gap-3">
                    <span className="text-muted-foreground shrink-0">Recru. Fee <span className="text-xs">(× {workers.length})</span></span>
                    <input
                      type="number" min={0} placeholder="0" value={recruFee}
                      onChange={(e) => setRecruFee(e.target.value)}
                      className="w-28 text-right bg-muted/40 border border-border rounded px-2 py-0.5 text-sm outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-1.5 gap-3">
                    <span className="text-muted-foreground shrink-0">Other Expenses</span>
                    <input
                      type="number" min={0} placeholder="0" value={otherExpenses}
                      onChange={(e) => setOtherExpenses(e.target.value)}
                      className="w-28 text-right bg-muted/40 border border-border rounded px-2 py-0.5 text-sm outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
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
    </div>
  );
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
