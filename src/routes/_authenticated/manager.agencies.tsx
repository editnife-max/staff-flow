import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, KeyRound, UserMinus } from "lucide-react";
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
import { createAgencyLogin, deleteAgencyLogin } from "@/lib/agencies.functions";

export const Route = createFileRoute("/_authenticated/manager/agencies")({
  head: () => ({ meta: [{ title: "Foreign Agencies — Staff-Flow" }] }),
  component: AgenciesPage,
});

type Agency = {
  id: string;
  name: string;
  country: string;
  status: string;
  contact_email: string | null;
  portal_user_id: string | null;
};

function AgenciesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Add agency dialog
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [email, setEmail] = useState("");

  // Create login dialog
  const [loginAgency, setLoginAgency] = useState<Agency | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const { data: agencies = [] } = useQuery<Agency[]>({
    queryKey: ["agencies", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("foreign_agencies")
        .select("id,name,country,status,contact_email,portal_user_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Agency[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("foreign_agencies").insert({
        manager_id: user!.id, name, country, contact_email: email || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agency added");
      qc.invalidateQueries({ queryKey: ["agencies"] });
      qc.invalidateQueries({ queryKey: ["agencies-offices-names"] });
      setAddOpen(false); setName(""); setCountry(""); setEmail("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("foreign_agencies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agencies"] });
      qc.invalidateQueries({ queryKey: ["agencies-offices-names"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createLogin = useMutation({
    mutationFn: async () => {
      if (!loginAgency) return;
      await createAgencyLogin({
        data: {
          agencyId: loginAgency.id,
          agencyName: loginAgency.name,
          email: loginEmail,
          password: loginPassword,
        },
      });
    },
    onSuccess: () => {
      toast.success("Portal login created");
      qc.invalidateQueries({ queryKey: ["agencies"] });
      setLoginAgency(null); setLoginEmail(""); setLoginPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeLogin = useMutation({
    mutationFn: async ({ agencyId, portalUserId }: { agencyId: string; portalUserId: string }) => {
      await deleteAgencyLogin({ data: { agencyId, portalUserId } });
    },
    onSuccess: () => {
      toast.success("Portal login removed");
      qc.invalidateQueries({ queryKey: ["agencies"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Foreign Agencies"
        description="Partner agencies sourcing candidates from abroad."
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Add agency</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add foreign agency</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-2"><Label>Country</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} /></div>
                <div className="space-y-2"><Label>Contact email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={() => create.mutate()} disabled={!name || !country || create.isPending}>
                  {create.isPending ? "Adding..." : "Add"}
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
                <TableHead>Agency</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {agencies.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{a.country}</TableCell>
                  <TableCell className="text-muted-foreground">{a.contact_email ?? "—"}</TableCell>
                  <TableCell>
                    <span className="inline-flex rounded-full bg-success/15 text-success px-2 py-0.5 text-xs">{a.status}</span>
                  </TableCell>
                  <TableCell>
                    {a.portal_user_id ? (
                      <span className="inline-flex rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs">Active</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">No login</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {a.portal_user_id ? (
                        <Button
                          variant="ghost" size="icon"
                          title="Remove portal login"
                          onClick={() => removeLogin.mutate({ agencyId: a.id, portalUserId: a.portal_user_id! })}
                          disabled={removeLogin.isPending}
                        >
                          <UserMinus className="h-4 w-4 text-destructive" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost" size="icon"
                          title="Create portal login"
                          onClick={() => { setLoginAgency(a); setLoginEmail(a.contact_email ?? ""); setLoginPassword(""); }}
                        >
                          <KeyRound className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(a.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {agencies.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No agencies yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create login dialog */}
      <Dialog open={!!loginAgency} onOpenChange={(o) => { if (!o) { setLoginAgency(null); setLoginEmail(""); setLoginPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create portal login — {loginAgency?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This creates a new account. The agency will log in with these credentials to view their sent candidates.
          </p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password (min 8 chars)</Label>
              <Input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setLoginAgency(null); setLoginEmail(""); setLoginPassword(""); }}>Cancel</Button>
            <Button
              onClick={() => createLogin.mutate()}
              disabled={!loginEmail || loginPassword.length < 8 || createLogin.isPending}
            >
              {createLogin.isPending ? "Creating..." : "Create login"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
