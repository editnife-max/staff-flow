import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Building2, Users, Search, Printer, Phone, Mail, MapPin, Globe } from "lucide-react";
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

const NAVY = "#1a3a6e";

type Candidate = {
  id: string;
  full_name: string;
  passport_number: string | null;
  occupation: string | null;
  ticket_date: string | null;
  cv_sent_to: string | null;
};

type OfficeGroup = { name: string; candidates: Candidate[] };

function ManagerInvoicePage() {
  const { user } = useAuth();
  const [search, setSearch]             = useState("");
  const [activeOffice, setActiveOffice] = useState<OfficeGroup | null>(null);

  // ── Persistent defaults (set once, carry across all invoices) ────────────
  const [fromCompany,    setFromCompany]    = useState("");
  const [fromAddress,    setFromAddress]    = useState("");
  const [fromPhone,      setFromPhone]      = useState("");
  const [fromEmail,      setFromEmail]      = useState(user?.email ?? "");
  const [fromWebsite,    setFromWebsite]    = useState("");
  const [recruFee,       setRecruFee]       = useState("");
  const [paymentName,    setPaymentName]    = useState("");
  const [paymentAccount, setPaymentAccount] = useState("");
  const [paymentBranch,  setPaymentBranch]  = useState("");

  // ── Per-invoice fields ───────────────────────────────────────────────────
  const [officeName,    setOfficeName]    = useState("");
  const [invoiceDate,   setInvoiceDate]   = useState(todayIso());
  const [otherExpenses, setOtherExpenses] = useState("");
  const [comments,      setComments]      = useState("");

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
    setComments("");
  }

  const invoiceNum = useMemo(() => {
    const d = new Date();
    return `INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOffice?.name]);

  const workers  = activeOffice?.candidates ?? [];
  const feeEach  = parseFloat(recruFee || "0") || 0;
  const subtotal = feeEach * workers.length;
  const taxesAmt = parseFloat(otherExpenses || "0") || 0;
  const total    = subtotal + taxesAmt;

  // ── Print ─────────────────────────────────────────────────────────────────
  function handlePrint() {
    const tableRows = workers.map((c, i) => `
      <tr>
        <td class="center">${i + 1}</td>
        <td>${c.full_name}</td>
        <td>${c.passport_number ?? ""}</td>
        <td>${c.ticket_date ? fmtDate(c.ticket_date) : ""}</td>
        <td>${c.occupation ?? ""}</td>
      </tr>`).join("");

    const win = window.open("", "_blank", "width=820,height=1000");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${invoiceNum}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;background:#fff;color:#111;font-size:12px;padding:28px 32px}
      .navy{color:${NAVY}}
      /* ── Header ── */
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px}
      .co-name{font-size:22px;font-weight:900;color:${NAVY};letter-spacing:1px;margin:6px 0 8px}
      .co-icon{font-size:13px;color:#444;margin-bottom:3px;display:flex;align-items:center;gap:6px}
      .addr-block{text-align:right;font-size:12px;color:#444;line-height:1.7}
      .inv-box{background:${NAVY};color:#fff;font-size:26px;font-weight:900;letter-spacing:3px;padding:8px 22px;margin-top:10px;display:inline-block}
      /* ── Client + Date row ── */
      .mid{display:flex;gap:16px;margin-bottom:0}
      .client-box{flex:0 0 45%}
      .client-hdr{background:${NAVY};color:#fff;font-size:12px;font-weight:700;padding:6px 10px;letter-spacing:.5px}
      .client-body{border:1.5px solid ${NAVY};border-top:none;min-height:56px;padding:8px 10px;font-size:12px;color:#111}
      .date-block{flex:1;padding-left:20px;padding-top:4px}
      .date-line{display:flex;align-items:baseline;gap:8px;margin-bottom:10px;font-size:12px}
      .date-line span{flex:1;border-bottom:1px solid #999}
      /* ── Table ── */
      table{width:100%;border-collapse:collapse;margin-top:0}
      thead tr{background:${NAVY};color:#fff}
      th{padding:7px 8px;font-size:11px;font-weight:700;text-align:left;border-right:1px solid rgba(255,255,255,.2)}
      th.center,td.center{text-align:center}
      th:last-child{border-right:none}
      td{padding:6px 8px;border-bottom:1px solid #c8d8f0;font-size:11.5px}
      tr:nth-child(even) td{background:#f0f5ff}
      /* ── Comments + Totals ── */
      .bot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:10px}
      .comments{font-size:11px;flex:1;padding-right:20px}
      .comments b{font-size:11px;text-transform:uppercase;display:block;margin-bottom:4px}
      .totals-table{border-collapse:collapse;width:240px}
      .totals-table td{padding:5px 10px;font-size:12px;border:1.5px solid ${NAVY}}
      .totals-table .lbl{background:${NAVY};color:#fff;font-weight:700;letter-spacing:.5px;width:55%}
      .totals-table .val{text-align:right;font-weight:600;width:45%}
      /* ── Payment footer ── */
      .pay-banner{background:${NAVY};color:#fff;font-size:12px;font-weight:700;letter-spacing:4px;text-align:center;padding:7px;margin-top:14px;text-transform:uppercase}
      .pay-details{display:flex;justify-content:space-between;align-items:center;padding:8px 4px 0}
      .pay-info{font-size:11.5px;line-height:1.8}
      .thank{font-size:12px;font-style:italic;color:${NAVY};font-weight:600}
    </style></head><body>
    <!-- Header -->
    <div class="header">
      <div>
        <div style="font-size:32px;color:${NAVY};font-weight:900;line-height:1">🏢</div>
        <div class="co-name">${fromCompany || "STAFF-FLOW"}</div>
        ${fromPhone   ? `<div class="co-icon">☎ ${fromPhone}</div>` : ""}
        ${fromEmail   ? `<div class="co-icon">✉ ${fromEmail}</div>` : ""}
        ${fromWebsite ? `<div class="co-icon">🌐 ${fromWebsite}</div>` : ""}
      </div>
      <div style="text-align:right">
        ${fromAddress ? `<div class="addr-block">◎ ${fromAddress.replace(/\n/g, "<br>")}</div>` : ""}
        <div class="inv-box">INVOICE</div>
      </div>
    </div>
    <!-- Client + Date -->
    <div class="mid">
      <div class="client-box">
        <div class="client-hdr">Client Details</div>
        <div class="client-body">${officeName || "&nbsp;"}</div>
      </div>
      <div class="date-block">
        <div class="date-line"><b>Date:</b> <span>${invoiceDate ? fmtDate(invoiceDate) : ""}</span></div>
        <div class="date-line"><b>Invoice No:</b> <span>${invoiceNum}</span></div>
      </div>
    </div>
    <!-- Table -->
    <table>
      <thead><tr>
        <th class="center" style="width:36px">No.</th>
        <th>Worker Name</th>
        <th>Passport No.</th>
        <th>Travel Date</th>
        <th>Profession</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    <!-- Comments + Totals -->
    <div class="bot">
      <div class="comments">
        <b>Other Comments:</b>
        ${comments || ""}
      </div>
      <table class="totals-table">
        <tr><td class="lbl">SUB TOTAL</td><td class="val">${subtotal.toLocaleString()}</td></tr>
        <tr><td class="lbl">TAXES</td><td class="val">${taxesAmt.toLocaleString()}</td></tr>
        <tr><td class="lbl">TOTAL</td><td class="val">${total.toLocaleString()}</td></tr>
      </table>
    </div>
    <!-- Payment footer -->
    <div class="pay-banner">P A Y M E N T &nbsp; D E T A I L S</div>
    <div class="pay-details">
      <div class="pay-info">
        ${paymentName    ? `<div><b>Bank Name:</b> ${paymentName}</div>` : ""}
        ${paymentAccount ? `<div><b>Acc No.:</b> ${paymentAccount}</div>` : ""}
        ${paymentBranch  ? `<div><b>Branch:</b> ${paymentBranch}</div>` : ""}
      </div>
      <div class="thank">Thank you for the business.</div>
    </div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Invoice"
        description={`${officeGroups.length} office${officeGroups.length !== 1 ? "s" : ""} · ${candidates.length} arrived worker${candidates.length !== 1 ? "s" : ""}`}
      />

      {/* Settings bar */}
      <Card className="rounded-none mb-5">
        <CardContent className="p-4 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Invoice From — set once, applies to all invoices</p>
          <div className="flex flex-wrap gap-3">
            <Field label="Company / Agency Name" w="flex-1 min-w-[150px]">
              <Input placeholder="Staff-Flow Agency" value={fromCompany} onChange={(e) => setFromCompany(e.target.value)} className="h-8 text-sm" />
            </Field>
            <Field label="Address" w="flex-1 min-w-[150px]">
              <Input placeholder="City, Country" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} className="h-8 text-sm" />
            </Field>
            <Field label="Office Number" w="min-w-[140px]">
              <Input placeholder="+1 234 567 890" value={fromPhone} onChange={(e) => setFromPhone(e.target.value)} className="h-8 w-44 text-sm" />
            </Field>
            <Field label="Email" w="flex-1 min-w-[150px]">
              <Input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} className="h-8 text-sm" />
            </Field>
            <Field label="Website (optional)" w="min-w-[150px]">
              <Input placeholder="www.example.com" value={fromWebsite} onChange={(e) => setFromWebsite(e.target.value)} className="h-8 w-44 text-sm" />
            </Field>
          </div>
          <div className="border-t pt-3 flex flex-wrap gap-3">
            <Field label="Recru. Fee (per worker)" w="">
              <input type="number" min={0} placeholder="0" value={recruFee} onChange={(e) => setRecruFee(e.target.value)}
                className="h-8 w-36 rounded border border-border bg-muted/40 px-3 text-sm outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            </Field>
            <Field label="Bank Name" w="min-w-[140px]">
              <Input placeholder="e.g. Commercial Bank" value={paymentName} onChange={(e) => setPaymentName(e.target.value)} className="h-8 w-44 text-sm" />
            </Field>
            <Field label="Account Number" w="min-w-[140px]">
              <Input placeholder="e.g. 1234 5678" value={paymentAccount} onChange={(e) => setPaymentAccount(e.target.value)} className="h-8 w-44 text-sm" />
            </Field>
            <Field label="Branch" w="min-w-[120px]">
              <Input placeholder="Branch name" value={paymentBranch} onChange={(e) => setPaymentBranch(e.target.value)} className="h-8 w-36 text-sm" />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search office…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
      </div>

      {/* Office cards */}
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

      {/* ── Invoice dialog ── */}
      <Dialog open={!!activeOffice} onOpenChange={(o) => { if (!o) setActiveOffice(null); }}>
        <DialogContent className="max-w-4xl p-0 gap-0 max-h-[95vh] flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
            <span className="text-sm font-semibold text-muted-foreground">{invoiceNum}</span>
            <Button size="sm" className="gap-1.5" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>

          {/* Invoice preview — scrollable */}
          <div className="overflow-y-auto flex-1 bg-gray-100 p-6">
            <div className="bg-white shadow-md mx-auto p-8 max-w-[680px] font-sans text-[13px] text-[#111]">

              {/* ── HEADER ── */}
              <div className="flex justify-between items-start mb-5">
                {/* Left: company */}
                <div>
                  <div className="text-4xl leading-none mb-1" style={{ color: NAVY }}>🏢</div>
                  <div className="text-xl font-black tracking-widest uppercase" style={{ color: NAVY }}>
                    {fromCompany || "STAFF-FLOW"}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-gray-600">
                    {fromPhone   && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{fromPhone}</div>}
                    {fromEmail   && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{fromEmail}</div>}
                    {fromWebsite && <div className="flex items-center gap-1.5"><Globe className="h-3 w-3" />{fromWebsite}</div>}
                  </div>
                </div>
                {/* Right: address + INVOICE box */}
                <div className="text-right">
                  {fromAddress && (
                    <div className="flex items-start justify-end gap-1.5 text-xs text-gray-600 mb-3">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: NAVY }} />
                      <span>{fromAddress}</span>
                    </div>
                  )}
                  <div className="inline-block text-white text-2xl font-black tracking-[6px] px-5 py-2" style={{ background: NAVY }}>
                    INVOICE
                  </div>
                </div>
              </div>

              {/* ── CLIENT DETAILS + DATE ── */}
              <div className="flex gap-5 mb-0">
                <div className="w-[44%]">
                  <div className="text-white text-xs font-bold px-3 py-1.5 tracking-wide" style={{ background: NAVY }}>
                    Client Details
                  </div>
                  <div className="border border-t-0 min-h-[54px] px-3 py-2 text-sm" style={{ borderColor: NAVY }}>
                    <Textarea
                      rows={2}
                      placeholder="Office / agency name…"
                      value={officeName}
                      onChange={(e) => setOfficeName(e.target.value)}
                      className="text-xs resize-none border-0 p-0 focus-visible:ring-0 shadow-none bg-transparent w-full"
                    />
                  </div>
                </div>
                <div className="flex-1 pt-2 space-y-3 text-xs">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold whitespace-nowrap">Date:</span>
                    <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                      className="flex-1 h-6 text-xs border-0 border-b rounded-none px-0 focus-visible:ring-0" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold whitespace-nowrap">Invoice No:</span>
                    <span className="flex-1 border-b border-gray-400 text-gray-500 pb-0.5">{invoiceNum}</span>
                  </div>
                </div>
              </div>

              {/* ── TABLE ── */}
              <div className="overflow-x-auto mt-0">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr style={{ background: NAVY }} className="text-white">
                      <th className="px-2 py-2 text-center w-9 border-r border-white/20">No.</th>
                      <th className="px-3 py-2 text-left border-r border-white/20">Worker Name</th>
                      <th className="px-3 py-2 text-left border-r border-white/20">Passport No.</th>
                      <th className="px-3 py-2 text-left border-r border-white/20">Travel Date</th>
                      <th className="px-3 py-2 text-left">Profession</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((c, i) => (
                      <tr key={c.id} className={cn("border-b", i % 2 !== 0 ? "bg-blue-50/60" : "")}
                        style={{ borderColor: "#c8d8f0" }}>
                        <td className="px-2 py-1.5 text-center text-gray-500">{i + 1}</td>
                        <td className="px-3 py-1.5 font-medium">{c.full_name}</td>
                        <td className="px-3 py-1.5 text-gray-600">{c.passport_number ?? "—"}</td>
                        <td className="px-3 py-1.5 text-gray-600">{c.ticket_date ? fmtDate(c.ticket_date) : "—"}</td>
                        <td className="px-3 py-1.5 text-gray-600">{c.occupation ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── COMMENTS + TOTALS ── */}
              <div className="flex justify-between items-end mt-4 gap-4">
                <div className="flex-1 text-xs">
                  <p className="font-bold uppercase text-[11px] mb-1">Other Comments:</p>
                  <Textarea rows={3} placeholder="Notes…" value={comments} onChange={(e) => setComments(e.target.value)}
                    className="text-xs resize-none w-full focus-visible:ring-0" />
                </div>
                <table className="border-collapse text-xs w-56 shrink-0">
                  <tbody>
                    <tr>
                      <td className="font-bold text-white px-3 py-2 text-[11px] tracking-wide" style={{ background: NAVY }}>SUB TOTAL</td>
                      <td className="px-3 py-2 text-right font-semibold border" style={{ borderColor: NAVY }}>
                        <input type="number" min={0} placeholder="fee/worker" value={recruFee}
                          onChange={(e) => setRecruFee(e.target.value)} title="Recru. fee per worker"
                          className="w-full text-right bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        {feeEach > 0 && <span className="text-gray-400 text-[9px] block">×{workers.length} = {subtotal.toLocaleString()}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="font-bold text-white px-3 py-2 text-[11px] tracking-wide" style={{ background: NAVY }}>TAXES</td>
                      <td className="px-3 py-2 text-right font-semibold border" style={{ borderColor: NAVY }}>
                        <input type="number" min={0} placeholder="0" value={otherExpenses}
                          onChange={(e) => setOtherExpenses(e.target.value)}
                          className="w-full text-right bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="font-bold text-white px-3 py-2 text-[11px] tracking-wide" style={{ background: NAVY }}>TOTAL</td>
                      <td className="px-3 py-2 text-right font-bold border text-base" style={{ borderColor: NAVY, color: NAVY }}>
                        {total.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── PAYMENT DETAILS ── */}
              <div className="mt-5">
                <div className="text-white text-xs font-bold tracking-[4px] text-center py-2 uppercase" style={{ background: NAVY }}>
                  P A Y M E N T &nbsp; D E T A I L S
                </div>
                <div className="flex justify-between items-start pt-2 px-1">
                  <div className="text-xs space-y-1 text-gray-700">
                    {paymentName    && <div><span className="font-bold">Bank Name:</span> {paymentName}</div>}
                    {paymentAccount && <div><span className="font-bold">Acc No.:</span> {paymentAccount}</div>}
                    {paymentBranch  && <div><span className="font-bold">Branch:</span> {paymentBranch}</div>}
                  </div>
                  <div className="text-xs font-semibold italic" style={{ color: NAVY }}>
                    Thank you for the business.
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

// ── Helpers ──────────────────────────────────────────────────────────────────
function Field({ label, w, children }: { label: string; w: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1", w)}>
      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function todayIso() { return new Date().toISOString().split("T")[0]; }

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
