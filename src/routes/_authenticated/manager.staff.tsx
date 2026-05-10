import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createStaffAccount, deleteStaffAccount } from "@/lib/staff-accounts.functions";

export const Route = createFileRoute("/_authenticated/manager/staff")({
  head: () => ({ meta: [{ title: "Staff — Staff-Flow" }] }),
  component: StaffPage,
});

function StaffPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const create = useServerFn(createStaffAccount);
  const remove = useServerFn(deleteStaffAccount);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleTitle, setRoleTitle] = useState("");

  const { data: staff = [] } = useQuery({
    queryKey: ["staff", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMut = useMutation({
    mutationFn: async () =>
      create({ data: { name, email, password, roleTitle: roleTitle || null } }),
    onSuccess: () => {
      toast.success("Staff account created");
      qc.invalidateQueries({ queryKey: ["staff"] });
      setOpen(false);
      setName(""); setEmail(""); setPassword(""); setRoleTitle("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (staffId: string) => remove({ data: { staffId } }),
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Create login accounts for your team. They can sign in with the email & password you set."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Create staff account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create a staff account</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label>Password</Label><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" /></div>
                <div className="space-y-2"><Label>Role title (optional)</Label><Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => createMut.mutate()}
                  disabled={!name || !email || password.length < 6 || createMut.isPending}
                >
                  {createMut.isPending ? "Creating..." : "Create account"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.email ?? "—"}</TableCell>
                  <TableCell>{s.role_title ?? "—"}</TableCell>
                  <TableCell><span className="inline-flex rounded-full bg-success/15 text-success px-2 py-0.5 text-xs">{s.status}</span></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => removeMut.mutate(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {staff.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No staff yet. Create the first account above.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
