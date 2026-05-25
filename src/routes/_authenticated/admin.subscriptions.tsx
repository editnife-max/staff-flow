import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, XCircle, ImageIcon } from "lucide-react";
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
import { getAdminSubscriptions, updateSubscriptionRequest } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  head: () => ({ meta: [{ title: "Subscriptions — Admin" }] }),
  component: AdminSubscriptionsPage,
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

function AdminSubscriptionsPage() {
  const qc = useQueryClient();
  const fetchSubs = useServerFn(getAdminSubscriptions);
  const doUpdate  = useServerFn(updateSubscriptionRequest);

  const { data: allSubs = [], isLoading } = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: () => fetchSubs({}),
  });

  const subs = [...allSubs].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const pendingCount = allSubs.filter((s) => s.status === "pending").length;

  const [proofUrl, setProofUrl] = useState<string | null>(null);

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; status: "approved" | "rejected" }) => doUpdate({ data: vars }),
    onSuccess: (_, vars) => {
      toast.success(vars.status === "approved" ? "Subscription approved" : "Request rejected");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function viewProof(storagePath: string) {
    const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(storagePath, 120);
    if (data?.signedUrl) setProofUrl(data.signedUrl);
    else toast.error("Could not load proof image");
  }

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description={pendingCount > 0 ? `${pendingCount} pending approval` : "All subscription requests"}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : subs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No subscription requests yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Manager</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((s) => (
                  <TableRow key={s.id} className={s.status === "pending" ? "bg-warning/5" : undefined}>
                    <TableCell><ManagerCell name={s.manager_name} email={s.manager_email} /></TableCell>
                    <TableCell className="font-medium">{PLAN_LABEL[s.plan] ?? s.plan}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_STYLE[s.status]?.variant ?? "outline"}>
                        {STATUS_STYLE[s.status]?.label ?? s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{s.notes ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(s.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        {s.screenshot_url && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                            onClick={() => viewProof(s.screenshot_url!)}>
                            <ImageIcon className="h-3.5 w-3.5 mr-1" /> Proof
                          </Button>
                        )}
                        {s.status === "pending" && (
                          <>
                            <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                              disabled={updateMut.isPending}
                              onClick={() => updateMut.mutate({ id: s.id, status: "approved" })}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs"
                              disabled={updateMut.isPending}
                              onClick={() => updateMut.mutate({ id: s.id, status: "rejected" })}>
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                      </div>
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
