import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { FileText, Printer, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
  contract_date: string | null;
  updated_at: string;
  created_at: string;
};

function ManagerInvoicePage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Candidate | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: candidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ["invoice-candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select(
          "id,full_name,photo_url,passport_number,country,occupation,gender,age," +
          "religion,arrival_city,cv_sent_to,candidate_code,contract_date,updated_at,created_at"
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

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) return;
    win.document.write(`
      <html><head><title>Invoice</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #111; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a3a52; padding-bottom: 16px; margin-bottom: 24px; }
        .company { font-size: 22px; font-weight: 700; color: #1a3a52; }
        .company-sub { font-size: 11px; color: #666; margin-top: 2px; }
        .invoice-label { font-size: 28px; font-weight: 700; color: #1a3a52; text-align: right; }
        .invoice-meta { font-size: 12px; color: #555; text-align: right; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #1a3a52; color: #fff; padding: 8px 10px; font-size: 11px; text-align: left; }
        td { padding: 8px 10px; font-size: 12px; border-bottom: 1px solid #e5e7eb; }
        tr:last-child td { border-bottom: none; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #888; text-align: center; }
        @media print { body { padding: 0; } }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

  const invoiceNumber = active
    ? `INV-${active.candidate_code ?? active.id.slice(0, 8).toUpperCase()}`
    : "";

  const invoiceDate = active
    ? new Date(active.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
    : "";

  return (
    <div>
      <PageHeader
        title="Invoice"
        description={`${filtered.length} arrived candidate${filtered.length !== 1 ? "s" : ""}`}
      />

      {/* Search */}
      <div className="relative mb-4 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search name, passport, code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No arrived candidates found.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Card key={c.id} className="rounded-none">
              <CardContent className="p-0">
                <div className="flex items-center gap-4 px-4 py-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    {c.photo_url && <AvatarImage src={c.photo_url} alt={c.full_name} />}
                    <AvatarFallback className="text-xs">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-0.5">
                    <Field label="Name"     value={c.full_name} />
                    <Field label="Passport" value={c.passport_number} />
                    <Field label="Country"  value={c.country} />
                    <Field label="Occupation" value={c.occupation} />
                    <Field label="Agency"   value={c.cv_sent_to} />
                    <Field label="City"     value={c.arrival_city} />
                    <Field label="Gender"   value={c.gender} />
                    <Field label="Religion" value={c.religion} />
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    onClick={() => setActive(c)}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Invoice
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Invoice dialog */}
      <Dialog open={!!active} onOpenChange={(o) => { if (!o) setActive(null); }}>
        <DialogContent className="max-w-2xl p-0 gap-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <span className="text-sm font-semibold">Invoice Preview</span>
            <Button size="sm" className="gap-1.5" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>

          {/* Printable area */}
          <div className="overflow-y-auto max-h-[75vh] p-6">
            <div ref={printRef}>
              {/* Invoice header */}
              <div className="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1a3a52", paddingBottom: "16px", marginBottom: "24px" }}>
                <div>
                  <div className="company" style={{ fontSize: "22px", fontWeight: 700, color: "#1a3a52" }}>Staff-Flow</div>
                  <div className="company-sub" style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>Recruitment & Placement Agency</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="invoice-label" style={{ fontSize: "28px", fontWeight: 700, color: "#1a3a52" }}>INVOICE</div>
                  <div className="invoice-meta" style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>
                    <div>No: {invoiceNumber}</div>
                    <div>Date: {invoiceDate}</div>
                  </div>
                </div>
              </div>

              {/* Candidate details */}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Field", "Details"].map((h) => (
                      <th key={h} style={{ background: "#1a3a52", color: "#fff", padding: "8px 10px", fontSize: "11px", textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Full Name",      active?.full_name],
                    ["Passport No.",   active?.passport_number],
                    ["Nationality",    active?.country],
                    ["Occupation",     active?.occupation],
                    ["Gender",         active?.gender],
                    ["Age",            active?.age != null ? String(active.age) : null],
                    ["Religion",       active?.religion],
                    ["Agency",         active?.cv_sent_to],
                    ["Arrival City",   active?.arrival_city],
                    ["Contract Date",  active?.contract_date
                      ? new Date(active.contract_date).toLocaleDateString("en-GB")
                      : null],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <tr key={label as string}>
                      <td style={{ padding: "8px 10px", fontSize: "12px", borderBottom: "1px solid #e5e7eb", fontWeight: 600, width: "40%" }}>{label}</td>
                      <td style={{ padding: "8px 10px", fontSize: "12px", borderBottom: "1px solid #e5e7eb" }}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="footer" style={{ marginTop: "32px", paddingTop: "16px", borderTop: "1px solid #e5e7eb", fontSize: "11px", color: "#888", textAlign: "center" }}>
                Generated by Staff-Flow · {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{label}</div>
      <div className="text-sm text-foreground truncate">{value}</div>
    </div>
  );
}
