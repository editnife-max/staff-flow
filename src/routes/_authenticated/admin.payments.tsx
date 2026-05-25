import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { getAdminSubscriptions } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({ meta: [{ title: "Payments — Admin" }] }),
  component: AdminPaymentsPage,
});

const PLAN_LABEL: Record<string, string> = { basic: "Basic", standard: "Standard", pro: "Pro" };
const STATUS_STYLE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:  { label: "Pending",  variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
};

function initials(name: string | null, email: string | null) {
  return (name ?? email ?? "?").slice(0, 2).toUpperCase();
}

function ManagerCell({ name, email }: { name: string | null; email: string | null }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar className="h-7 w-7">
        <AvatarFallback className="text-[11px] bg-accent/20 text-accent">{initials(name, email)}</AvatarFallback>
      </Avatar>
      <div>
        <div className="text-sm font-medium leading-tight">{name ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{email ?? "—"}</div>
      </div>
    </div>
  );
}

function AdminPaymentsPage() {
  const fetchSubs = useServerFn(getAdminSubscriptions);

  const { data: allSubs = [], isLoading } = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: () => fetchSubs({}),
  });

  const payments = allSubs.filter((s) => s.screenshot_url);

  const [proofUrl, setProofUrl] = useState<string | null>(null);

  async function viewProof(storagePath: string) {
    const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(storagePath, 120);
    if (data?.signedUrl) setProofUrl(data.signedUrl);
    else toast.error("Could not load proof image");
  }

  return (
    <div>
      <PageHeader
        title="Payments"
        description={`${payments.length} payment proof${payments.length !== 1 ? "s" : ""} submitted`}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : payments.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No payment proofs submitted yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Manager</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Proof</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><ManagerCell name={p.manager_name} email={p.manager_email} /></TableCell>
                    <TableCell className="font-medium">{PLAN_LABEL[p.plan] ?? p.plan}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_STYLE[p.status]?.variant ?? "outline"}>
                        {STATUS_STYLE[p.status]?.label ?? p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(p.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="h-7 text-xs"
                        onClick={() => viewProof(p.screenshot_url!)}>
                        <ImageIcon className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!proofUrl} onOpenChange={(o) => { if (!o) setProofUrl(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Payment Proof</DialogTitle></DialogHeader>
          {proofUrl && <img src={proofUrl} alt="Payment proof" className="w-full rounded-md object-contain max-h-[70vh]" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
