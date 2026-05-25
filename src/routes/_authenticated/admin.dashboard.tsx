import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users, Bell, Trash2, ShieldAlert,
  UserPlus, Briefcase, Globe2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  getAdminStats, getAdminUsers, createAdminUser, removeUser,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({ meta: [{ title: "Admin — Staff-Flow" }] }),
  component: AdminDashboard,
});

const ROLE_STYLE: Record<string, { label: string; cls: string }> = {
  admin:   { label: "Admin",           cls: "bg-purple-500/15 text-purple-600" },
  manager: { label: "Manager",         cls: "bg-primary/15 text-primary" },
  staff:   { label: "Staff",           cls: "bg-blue-500/15 text-blue-600" },
  agency:  { label: "Foreign Agency",  cls: "bg-emerald-500/15 text-emerald-600" },
};

function initials(name: string | null, email: string | null) {
  return (name ?? email ?? "?").slice(0, 2).toUpperCase();
}

function UserCell({ name, email }: { name: string | null; email: string | null }) {
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

function RoleBadge({ role }: { role: string }) {
  const s = ROLE_STYLE[role] ?? { label: role, cls: "bg-muted text-muted-foreground" };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function AdminDashboard() {
  const qc = useQueryClient();
  const fetchStats = useServerFn(getAdminStats);
  const fetchUsers = useServerFn(getAdminUsers);
  const doCreate   = useServerFn(createAdminUser);
  const doRemove   = useServerFn(removeUser);

  const { data: stats } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => fetchStats({}),
  });
  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetchUsers({}),
  });

  // --- Create user dialog ---
  const [createOpen, setCreateOpen] = useState(false);
  const [newRole, setNewRole] = useState<"admin" | "agency">("admin");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newAgencyName, setNewAgencyName] = useState("");

  function resetCreate() {
    setCreateOpen(false); setNewRole("admin"); setNewName(""); setNewEmail("");
    setNewPassword(""); setNewAgencyName("");
  }

  // --- Filters / confirm remove ---
  const [roleFilter, setRoleFilter] = useState("all");
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; role: string; name: string | null } | null>(null);

  const filteredUsers = roleFilter === "all"
    ? allUsers
    : allUsers.filter((u) => u.role === roleFilter);

  const createValid = newName.trim() && newEmail.includes("@") && newPassword.length >= 8;

  const createMut = useMutation({
    mutationFn: () => doCreate({
      data: {
        role: newRole,
        full_name: newName,
        email: newEmail,
        password: newPassword,
        manager_id: null,
        agency_name: newRole === "agency" && newAgencyName ? newAgencyName : null,
      },
    }),
    onSuccess: () => {
      toast.success("User created");
      qc.invalidateQueries({ queryKey: ["admin"] });
      resetCreate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async () => {
      if (confirmRemove) await doRemove({ data: { userId: confirmRemove.id, role: confirmRemove.role as any } });
    },
    onSuccess: () => {
      toast.success("User removed");
      qc.invalidateQueries({ queryKey: ["admin"] });
      setConfirmRemove(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Admin Panel" description="Overview and user management." />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Managers"          value={stats?.managers ?? "—"}    icon={Briefcase}    tone="default" />
        <StatCard label="Staff"             value={stats?.staff ?? "—"}       icon={Users}        tone="default" />
        <StatCard label="Foreign Agencies"  value={stats?.agencies ?? "—"}    icon={Globe2}       tone="default" />
        <StatCard label="Pending Approvals" value={stats?.pendingSubs ?? "—"} icon={Bell}
          tone={stats?.pendingSubs ? "warning" : "default"} />
      </div>

      {/* Users */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="agency">Foreign Agency</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Add user
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {usersLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No users found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={`${u.id}-${u.role}`}>
                    <TableCell><UserCell name={u.full_name} email={u.email} /></TableCell>
                    <TableCell><RoleBadge role={u.role} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.role === "staff" && u.manager_name ? `Manager: ${u.manager_name}` :
                       u.role === "agency" && u.agency_name ? `Office: ${u.agency_name}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(u.joined).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmRemove({ id: u.id, role: u.role, name: u.full_name ?? u.email })}>
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

      {/* Create user dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) resetCreate(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add user</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="agency">Foreign Agency</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            {newRole === "agency" && (
              <div className="space-y-2">
                <Label>Agency / Office name</Label>
                <Input
                  value={newAgencyName}
                  onChange={(e) => setNewAgencyName(e.target.value)}
                  placeholder="Must match cv_sent_to value used by staff"
                />
              </div>
            )}
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
              <ShieldAlert className="h-5 w-5 text-destructive" /> Remove User
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmRemove?.role === "agency"
              ? `This permanently deletes the portal account for "${confirmRemove?.name}".`
              : `This revokes the ${confirmRemove?.role} role from "${confirmRemove?.name}". Their data remains in the database.`}
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
