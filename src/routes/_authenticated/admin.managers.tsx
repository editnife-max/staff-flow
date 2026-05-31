import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, Trash2, ShieldAlert, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAdminManagers, createManager, removeManager, forceResetPassword } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/managers")({
  head: () => ({ meta: [{ title: "Managers — Admin" }] }),
  component: AdminManagersPage,
});

const PLAN_LABEL: Record<string, string> = { basic: "Basic", standard: "Standard", pro: "Pro" };

function initials(name: string | null, email: string | null) {
  return (name ?? email ?? "?").slice(0, 2).toUpperCase();
}

function AdminManagersPage() {
  const qc = useQueryClient();
  const fetchManagers = useServerFn(getAdminManagers);
  const doCreate      = useServerFn(createManager);
  const doRemove      = useServerFn(removeManager);
  const doResetPw     = useServerFn(forceResetPassword);

  const { data: managers = [], isLoading } = useQuery({
    queryKey: ["admin", "managers"],
    queryFn: () => fetchManagers({}),
  });

  // Create dialog
  const [createOpen, setCreateOpen]   = useState(false);
  const [newName, setNewName]         = useState("");
  const [newEmail, setNewEmail]       = useState("");
  const [newPassword, setNewPassword] = useState("");

  function resetCreate() {
    setCreateOpen(false); setNewName(""); setNewEmail(""); setNewPassword("");
  }

  // Remove confirm
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string | null } | null>(null);

  // Reset password
  const [resetTarget,   setResetTarget]   = useState<{ id: string; name: string | null } | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmPw,     setConfirmPw]     = useState("");

  function closeReset() { setResetTarget(null); setResetPassword(""); setConfirmPw(""); }

  const resetValid = resetPassword.length >= 8 && resetPassword === confirmPw;

  const resetMut = useMutation({
    mutationFn: () => doResetPw({ data: { userId: resetTarget!.id, newPassword: resetPassword } }),
    onSuccess: () => { toast.success("Password reset successfully"); closeReset(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createValid = newName.trim() && newEmail.includes("@") && newPassword.length >= 8;

  const createMut = useMutation({
    mutationFn: () => doCreate({ data: { full_name: newName.trim(), email: newEmail, password: newPassword } }),
    onSuccess: () => {
      toast.success("Manager account created");
      qc.invalidateQueries({ queryKey: ["admin"] });
      resetCreate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async () => {
      if (confirmRemove) await doRemove({ data: { userId: confirmRemove.id } });
    },
    onSuccess: () => {
      toast.success("Manager removed");
      qc.invalidateQueries({ queryKey: ["admin"] });
      setConfirmRemove(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Managers"
        description={`${managers.length} manager account${managers.length !== 1 ? "s" : ""}`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Add manager
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
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
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[11px] bg-accent/20 text-accent">
                            {initials(m.full_name, m.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium leading-tight">{m.full_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{m.email ?? "—"}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {m.active_plan
                        ? <Badge variant="default">{PLAN_LABEL[m.active_plan.plan] ?? m.active_plan.plan}</Badge>
                        : <span className="text-xs text-muted-foreground">No plan</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.active_plan ? new Date(m.active_plan.since).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(m.joined).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          onClick={() => setResetTarget({ id: m.id, name: m.full_name ?? m.email })}
                        >
                          <KeyRound className="h-3.5 w-3.5 mr-1" /> Reset Password
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmRemove({ id: m.id, name: m.full_name ?? m.email })}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create manager dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) resetCreate(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add manager</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password <span className="text-muted-foreground text-xs">(min 8 chars)</span></Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={resetCreate}>Cancel</Button>
            <Button onClick={() => createMut.mutate()} disabled={!createValid || createMut.isPending}>
              {createMut.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Force reset password dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => { if (!o) closeReset(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" /> Reset Password
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Set a new password for <strong>{resetTarget?.name}</strong>.
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>New password <span className="text-muted-foreground text-xs">(min 8 chars)</span></Label>
              <Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm password</Label>
              <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
              {confirmPw && !resetValid && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeReset}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!resetValid || resetMut.isPending}
              onClick={() => resetMut.mutate()}
            >
              {resetMut.isPending ? "Resetting…" : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm remove dialog */}
      <Dialog open={!!confirmRemove} onOpenChange={(o) => { if (!o) setConfirmRemove(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" /> Remove Manager
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This revokes the manager role from <strong>{confirmRemove?.name}</strong>. Their candidates and staff data remain in the database.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmRemove(null)}>Cancel</Button>
            <Button variant="destructive" disabled={removeMut.isPending} onClick={() => removeMut.mutate()}>
              {removeMut.isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
