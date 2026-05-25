import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Printer, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
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
  photo_url: string | null;
  passport_number: string | null;
  country: string | null;
  occupation: string | null;
  gender: string | null;
  age: number | null;
  religion: string | null;
  arrival_city: string | null;
  cv_sent_to: string | null;
  candidate_code: string | null;
  ticket_date: string | null;
  updated_at: string;
};

function ManagerInvoicePage() {
  const { user } = useAuth();
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  // Left-side editable fields
  const [officeName, setOfficeName] = useState("");
  const [payment, setPayment]       = useState("");
  const [term, setTerm]             = useState("");

  // Right-side editable fields
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [dueDate, setDueDate]         = useState("");

  // Per-row fee (keyed by candidate id)
  const [fees, setFees]             = useState<Record<string, string>>({});
  const [otherExpenses, setOtherExpenses] = useState("");

  const { data: candidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ["invoice-candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select(
          "id,full_name,photo_url,passport_number,country,occupation,gender,age," +
          "religion,arrival_city,cv_sent_to,candidate_code,ticket_date,updated_at"
        )
        .eq("status", "arrived")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Candidate[];
    },
    enabled: !!user,
  });

  const filtered = candidates.filter((c) =>
    !search ||
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.passport_number ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.candidate_code ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const invoiceCandidates = candidates.filter((c) => selected.has(c.id));

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((c) => c.id)));
  }

  function openInvoice() {
    const init: Record<string, string> = {};
    invoiceCandidates.forEach((c) => { if (!fees[c.id]) init[c.id] = ""; });
    if (Object.keys(init).length) setFees((f) => ({ ...f, ...init }));
    setInvoiceOpen(true);
  }

  function closeInvoice() { setInvoiceOpen(false); }

  const invoiceNum = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;

  const subtotal = invoiceCandidates.reduce((sum, c) => sum + (parseFloat(fees[c.id] || "0") || 0), 0);
  const other    = parseFloat(otherExpenses || "0") || 0;
  const total    = subtotal + other;

  function handlePrint() {
    const rows = invoiceCandidates.map((c, i) => `
      <tr>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${i + 1}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb">${c.full_name}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb">${c.passport_number ?? "—"}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb">${c.ticket_date ? fmt(c.ticket_date) : "—"}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb">${c.occupation ?? "—"}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${fees[c.id] ? Number(fees[c.id]).toLocaleString() : "—"}</td>
      </tr>
    `).join("");

    const win = window.open("", "_blank", "width=960,height=700");
    if (!win) return;
    win.document.write(`
      <html><head><title>Invoice ${invoiceNum}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,sans-serif;padding:32px;color:#111;font-size:13px}
        .wrap{display:flex;gap:32px;align-items:flex-start}
        .left{width:220px;flex-shrink:0;display:flex;flex-direction:column;gap:16px}
        .right{flex:1}
        .logo{font-size:20px;font-weight:700;color:#1a3a52;letter-spacing:-0.5px}
        .logo-sub{font-size:10px;color:#888;margin-top:2px}
        .inv-title{font-size:26px;font-weight:700;color:#1a3a52;text-align:right}
        .inv-meta{font-size:11px;color:#555;text-align:right;margin-top:4px;line-height:1.7}
        .section-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px}
        .section-value{font-size:13px;color:#111;word-break:break-word}
        .thank{margin-top:auto;padding-top:24px;font-size:13px;font-weight:700;color:#1a3a52;letter-spacing:0.5px}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th{background:#1a3a52;color:#fff;padding:8px 10px;font-size:11px;text-align:left;white-space:nowrap}
        th:last-child,td:last-child{text-align:right}
        td{padding:7px 10px;font-size:12px;border-bottom:1px solid #e5e7eb}
        .totals{margin-top:12px;margin-left:auto;width:260px}
        .tot-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;border-bottom:1px solid #e5e7eb}
        .tot-row.total{font-weight:700;font-size:14px;border-bottom:none;padding-top:8px}
        .divider{border-top:2px solid #1a3a52;margin:16px 0}
        @media print{body{padding:16px}}
      </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a3a52;padding-bottom:14px;margin-bottom:20px">
        <div><div class="logo">Staff-Flow</div><div class="logo-sub">Recruitment &amp; Placement Agency</div></div>
        <div><div class="inv-title">INVOICE</div>
          <div class="inv-meta">
            <div><b>No:</b> ${invoiceNum}</div>
            <div><b>Invoice Date:</b> ${invoiceDate ? fmt(invoiceDate) : "—"}</div>
            ${dueDate ? `<div><b>Due Date:</b> ${fmt(dueDate)}</div>` : ""}
          </div>
        </div>
      </div>
      <div class="wrap">
        <div class="left">
          ${officeName ? `<div><div class="section-title">Bill To / Office</div><div class="section-value">${officeName}</div></div>` : ""}
          ${payment ? `<div><div class="section-title">Payment</div><div class="section-value">${payment}</div></div>` : ""}
          ${term ? `<div><div class="section-title">Terms</div><div class="section-value">${term}</div></div>` : ""}
          <div class="thank">THANK YOU FOR<br>YOUR BUSINESS</div>
        </div>
        <div class="right">
          <table>
            <thead><tr>
              <th style="width:36px;text-align:center">#</th>
              <th>Worker Name</th>
              <th>Passport No.</th>
              <th>Travel Date</th>
              <th>Profession</th>
              <th>Recru. Fee</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="totals">
            <div class="tot-row"><span>Subtotal</span><span>${subtotal.toLocaleString()}</span></div>
            <div class="tot-row"><span>Other Expenses</span><span>${other.toLocaleString()}</span></div>
            <div class="tot-row total"><span>Total Due</span><span>${total.toLocaleString()}</span></div>
          </div>
        </div>
      </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

  return (
    <div>
      <PageHeader
        title="Invoice"
        description={`${filtered.length} arrived candidate${filtered.length !== 1 ? "s" : ""}`}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, passport, code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        {selected.size > 0 && (
          <Button className="gap-1.5" onClick={openInvoice}>
            <FileText className="h-4 w-4" />
            Generate Invoice ({selected.size})
          </Button>
        )}
      </div>

      {/* Select-all row */}
      {filtered.length > 0 && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none mb-2 px-1">
          <Checkbox
            checked={selected.size > 0 && selected.size === filtered.length}
            onCheckedChange={toggleAll}
            aria-label="Select all"
          />
          {selected.size > 0 ? `${selected.size} selected` : "Select all"}
        </label>
      )}

      {/* Candidates list */}
      {isLoading ? (
        <Card className="rounded-none"><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card className="rounded-none"><CardContent className="p-8 text-center text-sm text-muted-foreground">No arrived candidates found.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Card key={c.id} className={cn("rounded-none transition-colors", selected.has(c.id) && "ring-2 ring-primary")}>
              <CardContent className="p-0">
                <div className="flex items-center gap-3 px-4 py-3">
                  <Checkbox
                    checked={selected.has(c.id)}
                    onCheckedChange={() => toggleSelect(c.id)}
                    aria-label="Select"
                  />
                  <Avatar className="h-10 w-10 shrink-0">
                    {c.photo_url && <AvatarImage src={c.photo_url} alt={c.full_name} />}
                    <AvatarFallback className="text-xs">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-0.5">
                    <InlineField label="Name"       value={c.full_name} />
                    <InlineField label="Passport"   value={c.passport_number} />
                    <InlineField label="Profession" value={c.occupation} />
                    <InlineField label="Country"    value={c.country} />
                    <InlineField label="Agency"     value={c.cv_sent_to} />
                    <InlineField label="City"       value={c.arrival_city} />
                    <InlineField label="Travel Date" value={c.ticket_date ? fmt(c.ticket_date) : null} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Invoice dialog */}
      <Dialog open={invoiceOpen} onOpenChange={(o) => { if (!o) closeInvoice(); }}>
        <DialogContent className="max-w-5xl p-0 gap-0 max-h-[95vh] flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
            <span className="text-sm font-semibold">Invoice — {invoiceNum}</span>
            <Button size="sm" className="gap-1.5" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>

          <div className="overflow-y-auto flex-1 p-6">
            {/* Header row */}
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

              {/* ── LEFT ── */}
              <div className="w-52 shrink-0 flex flex-col gap-5">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bill To / Office Name</Label>
                  <Textarea
                    rows={3}
                    placeholder="Office name & address…"
                    value={officeName}
                    onChange={(e) => setOfficeName(e.target.value)}
                    className="text-sm resize-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment</Label>
                  <Input
                    placeholder="e.g. Bank Transfer"
                    value={payment}
                    onChange={(e) => setPayment(e.target.value)}
                    className="text-sm h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Terms</Label>
                  <Input
                    placeholder="e.g. Net 30"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="text-sm h-8"
                  />
                </div>
                <div className="mt-auto pt-6 text-sm font-bold text-[#1a3a52] leading-snug">
                  THANK YOU FOR<br />YOUR BUSINESS
                </div>
              </div>

              {/* ── RIGHT ── */}
              <div className="flex-1 min-w-0 flex flex-col gap-4">
                {/* Dates */}
                <div className="flex gap-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Invoice Date</Label>
                    <Input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="text-sm h-8 w-40"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Due Date</Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="text-sm h-8 w-40"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#1a3a52] text-white text-xs">
                        <th className="px-3 py-2 text-center w-10">#</th>
                        <th className="px-3 py-2 text-left">Worker Name</th>
                        <th className="px-3 py-2 text-left">Passport No.</th>
                        <th className="px-3 py-2 text-left">Travel Date</th>
                        <th className="px-3 py-2 text-left">Profession</th>
                        <th className="px-3 py-2 text-right w-28">Recru. Fee</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceCandidates.map((c, i) => (
                        <tr key={c.id} className="border-b border-border/60 hover:bg-muted/30">
                          <td className="px-3 py-2 text-center text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-2 font-medium">{c.full_name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{c.passport_number ?? "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{c.ticket_date ? fmt(c.ticket_date) : "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{c.occupation ?? "—"}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              placeholder="0"
                              value={fees[c.id] ?? ""}
                              onChange={(e) => setFees((f) => ({ ...f, [c.id]: e.target.value }))}
                              className="w-full text-right bg-muted/40 border border-border rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="ml-auto w-64 space-y-1 text-sm">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-1 gap-3">
                    <span className="text-muted-foreground shrink-0">Other Expenses</span>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={otherExpenses}
                      onChange={(e) => setOtherExpenses(e.target.value)}
                      className="w-28 text-right bg-muted/40 border border-border rounded px-2 py-0.5 text-sm outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="font-bold text-[#1a3a52]">Total Due</span>
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

function InlineField({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{label}</div>
      <div className="text-sm text-foreground truncate">{value}</div>
    </div>
  );
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
