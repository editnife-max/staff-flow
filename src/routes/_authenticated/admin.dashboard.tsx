import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Bell, CheckCircle2, XCircle, ImageIcon, Trash2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import {
  getAdminStats, getAdminSubscriptions, updateSubscriptionRequest,
  getAdminManagers, removeManager,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({ meta: [{ title: "Admin — Staff-Flow" }] }),
  component: AdminDashboard,
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
        <AvatarFallback className="text-[11px] bg-accent/20 text-accent">
          {initials(name, email)}
        </AvatarFallback>
      </Avatar>
      <div>
        <div className="text-sm font-medium leading-tight">{name ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{email ?? "—"}</div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const qc = useQueryClient();
  const fetchStats      = useServerFn(getAdminStats);
  const fetchSubs       = useServerFn(getAdminSubscriptions);
  const doUpdate        = useServerFn(updateSubscriptionRequest);
  const fetchManagers   = useServerFn(getAdminManagers);
  const doRemove        = useServerFn(removeManager);

  const { data: stats } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => fetchStats({}),
  });

  const { data: allSubs = [], isLoading: subsLoading } = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: () => fetchSubs({}),
  });

  const { data: managers = [], isLoading: managersLoading } = useQuery({
    queryKey: ["admin", "managers"],
    queryFn: () => fetchManagers({}),
  });

  // Pending first, then by date desc
  const subs = [...allSubs].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const payments = allSubs.filter((s) => s.screenshot_url);
  const pendingCount = allSubs.filter((s) => s.status === "pending").length;

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; status: "approved" | "rejected" }) => doUpdate({ data: vars }),
    onSuccess: (_, vars) => {
      toast.success(vars.status === "approved" ? "Subscription approved" : "Request rejected");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) => doRemove({ data: { userId } }),
    onSuccess: () => {
      toast.success("Manager removed");
      qc.invalidateQueries({ queryKey: ["admin"] });
      setConfirmRemove(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [proofUrl, setProofUrl]         = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  async function viewProof(storagePath: string) {
    const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(storagePath, 120);
    if (data?.signedUrl) setProofUrl(data.signedUrl);
    else toast.error("Could not load proof image");
  }

  return (
    <div>
      <PageHeader title="Admin Panel" description="Subscription approvals, manager accounts, and payment review." />

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Pending Approvals" value={stats?.pendingSubs ?? "—"} icon={Bell}
          tone={stats?.pendingSubs ? "warning" : "default"} />
        <StatCard label="Total Managers"    value={stats?.managers ?? "—"}    icon={Users}        tone="default" />
        <StatCard label="Approved Plans"    value={stats?.approvedPlans ?? "—"} icon={CheckCircle2} tone="success" />
      </div>

      <Tabs defaultValue="subscriptions">
        <TabsList className="mb-4">
          <TabsTrigger value="subscriptions">
            Subscriptions
            {pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 leading-none">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="managers">Managers</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        {/* ── Subscriptions ── */}
        <TabsContent value="subscriptions">
          <Card>
            <CardContent className="p-0">
              {subsLoading ? (
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
                        <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                          {s.notes ?? "—"}
                        </TableCell>
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
                                <Button size="sm"
                                  className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
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
        </TabsContent>

        {/* ── Managers ── */}
        <TabsContent value="managers">
          <Card>
            <CardContent className="p-0">
              {managersLoading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
              ) : managers.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No managers yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Manager</TableHead>
                      <TableHead>Active Plan</TableHead>
                      <TableHead>Plan Since</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {managers.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell><ManagerCell name={m.full_name} email={m.email} /></TableCell>
                        <TableCell>
                          {m.active_plan
                            ? <span className="font-medium">{PLAN_LABEL[m.active_plan.plan] ?? m.active_plan.plan}</span>
                            : <span className="text-xs text-muted-foreground">No plan</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.active_plan ? new Date(m.active_plan.since).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(m.joined).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm"
                            className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setConfirmRemove(m.id)}>
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Payments ── */}
        <TabsContent value="payments">
          <Card>
            <CardContent className="p-0">
              {subsLoading ? (
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
        </TabsContent>
      </Tabs>

      {/* Payment proof dialog */}
      <Dialog open={!!proofUrl} onOpenChange={(o) => { if (!o) setProofUrl(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Payment Proof</DialogTitle></DialogHeader>
          {proofUrl && <img src={proofUrl} alt="Payment proof" className="w-full rounded-md object-contain max-h-[70vh]" />}
        </DialogContent>
      </Dialog>

      {/* Remove manager confirm */}
      <Dialog open={!!confirmRemove} onOpenChange={(o) => { if (!o) setConfirmRemove(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" /> Remove Manager
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This revokes their manager role. Their candidates and staff data remain in the database.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmRemove(null)}>Cancel</Button>
            <Button variant="destructive" disabled={removeMut.isPending}
              onClick={() => confirmRemove && removeMut.mutate(confirmRemove)}>
              {removeMut.isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
