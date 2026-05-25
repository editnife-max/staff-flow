import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, Trash2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAdminUsers, createAdminUser, removeUser } from "@/lib/admin.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/admins")({
  head: () => ({ meta: [{ title: "Admins — Admin Panel" }] }),
  component: AdminAdminsPage,
});

function initials(name: string | null, email: string | null) {
  return (name ?? email ?? "?").slice(0, 2).toUpperCase();
}

function AdminAdminsPage() {
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();
  const fetchUsers = useServerFn(getAdminUsers);
  const doCreate   = useServerFn(createAdminUser);
  const doRemove   = useServerFn(removeUser);

  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetchUsers({}),
  });

  const admins = allUsers.filter((u) => u.role === "admin");

  // Create dialog
  const [createOpen, setCreateOpen]   = useState(false);
  const [newName, setNewName]         = useState("");
  const [newEmail, setNewEmail]       = useState("");
  const [newPassword, setNewPassword] = useState("");

  function resetCreate() {
    setCreateOpen(false); setNewName(""); setNewEmail(""); setNewPassword("");
  }

  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string | null } | null>(null);

  const createValid = newName.trim() && newEmail.includes("@") && newPassword.length >= 8;

  const createMut = useMutation({
    mutationFn: () => doCreate({
      data: { role: "admin", full_name: newName.trim(), email: newEmail, password: newPassword, manager_id: null, agency_name: null },
    }),
    onSuccess: () => {
      toast.success("Admin account created");
      qc.invalidateQueries({ queryKey: ["admin"] });
      resetCreate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async () => {
      if (confirmRemove) await doRemove({ data: { userId: confirmRemove.id, role: "admin" } });
    },
    onSuccess: () => {
      toast.success("Admin removed");
      qc.invalidateQueries({ queryKey: ["admin"] });
      setConfirmRemove(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Admins"
        description={`${admins.length} admin account${admins.length !== 1 ? "s" : ""}`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Add admin
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : admins.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No admins found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admin</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[11px] bg-purple-500/20 text-purple-600">
                            {initials(a.full_name, a.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium leading-tight">{a.full_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{a.email ?? "—"}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(a.joined).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {a.id === currentUser?.id ? (
                        <span className="text-xs text-muted-foreground px-2">You</span>
                      ) : (
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmRemove({ id: a.id, name: a.full_name ?? a.email })}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create admin dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) resetCreate(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add admin</DialogTitle></DialogHeader>
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

      {/* Confirm remove dialog */}
      <Dialog open={!!confirmRemove} onOpenChange={(o) => { if (!o) setConfirmRemove(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" /> Remove Admin
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This revokes admin access from <strong>{confirmRemove?.name}</strong>. Their account remains but they will lose admin privileges.
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
