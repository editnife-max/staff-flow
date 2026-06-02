import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, KeyRound, UserMinus, Clock } from "lucide-react";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createAgencyLogin, deleteAgencyLogin, resetAgencyPassword } from "@/lib/agencies.functions";

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

type Office = { id: string; name: string };

function AgenciesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [cvDaysEdit, setCvDaysEdit] = useState(false);
  const [cvDaysDraft, setCvDaysDraft] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["manager-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("cv_days_threshold")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const cvDaysThreshold = profile?.cv_days_threshold ?? 7;

  const updateThreshold = useMutation({
    mutationFn: async (days: number) => {
      const { error } = await supabase
        .from("profiles")
        .update({ cv_days_threshold: days })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manager-profile", user?.id] });
      setCvDaysEdit(false);
      toast.success("CV requirement days updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Add agency + login dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addOfficeId, setAddOfficeId] = useState("");
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");

  // Create login for existing agency dialog
  const [loginAgency, setLoginAgency] = useState<Agency | null>(null);
  const [loginOfficeId, setLoginOfficeId] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Reset password dialog
  const [resetTarget,   setResetTarget]   = useState<{ portalUserId: string; name: string } | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmPw,     setConfirmPw]     = useState("");
  function closeReset() { setResetTarget(null); setResetPassword(""); setConfirmPw(""); }
  const resetValid = resetPassword.length >= 8 && resetPassword === confirmPw;

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

  const { data: offices = [] } = useQuery<Office[]>({
    queryKey: ["assignment-offices", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_offices")
        .select("id,name")
        .order("name");
      if (error) throw error;
      return data as Office[];
    },
  });

  function officeNameById(id: string) {
    return offices.find((o) => o.id === id)?.name ?? "";
  }

  // --- Create agency + portal login ---
  const createWithLogin = useMutation({
    mutationFn: async () => {
      const officeName = officeNameById(addOfficeId);
      // 1. Insert agency row
      const { data: row, error: insErr } = await supabase
        .from("foreign_agencies")
        .insert({ manager_id: user!.id, name: addName || officeName, country: officeName, contact_email: addEmail || null })
        .select("id")
        .single();
      if (insErr) throw insErr;
      // 2. Create portal login
      await createAgencyLogin({
        data: { agencyId: row.id, agencyName: officeName, email: addEmail, password: addPassword },
      });
    },
    onSuccess: () => {
      toast.success("Agency and portal login created");
      qc.invalidateQueries({ queryKey: ["agencies"] });
      qc.invalidateQueries({ queryKey: ["agencies-offices-names"] });
      setAddOpen(false); setAddOfficeId(""); setAddName(""); setAddEmail(""); setAddPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- Remove agency ---
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

  // --- Create login for existing agency ---
  const createLogin = useMutation({
    mutationFn: async () => {
      if (!loginAgency) return;
      const officeName = officeNameById(loginOfficeId);
      await createAgencyLogin({
        data: { agencyId: loginAgency.id, agencyName: officeName, email: loginEmail, password: loginPassword },
      });
    },
    onSuccess: () => {
      toast.success("Portal login created");
      qc.invalidateQueries({ queryKey: ["agencies"] });
      setLoginAgency(null); setLoginOfficeId(""); setLoginEmail(""); setLoginPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- Remove login ---
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

  const doResetPw = useMutation({
    mutationFn: () => resetAgencyPassword({ data: { portalUserId: resetTarget!.portalUserId, newPassword: resetPassword } }),
    onSuccess: () => { toast.success("Password reset successfully"); closeReset(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addValid = !!addOfficeId && addEmail.includes("@") && addPassword.length >= 8;
  const loginValid = !!loginOfficeId && loginEmail.includes("@") && loginPassword.length >= 8;

  return (
    <div>
      <PageHeader
        title="Foreign Agencies"
        description="Partner agencies sourcing candidates from abroad."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add agency
          </Button>
        }
      />

      {/* CV Requirement Days */}
      <Card className="mb-4 rounded-none">
        <CardContent className="px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold">CV Requirement Days</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  If a CV is sent to an agency but the candidate is not selected within this many days, they reappear in the CV page for resending.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {cvDaysEdit ? (
                <>
                  <input
                    autoFocus
                    type="number"
                    min={1}
                    value={cvDaysDraft}
                    onChange={(e) => setCvDaysDraft(e.target.value)}
                    className="w-16 border border-input rounded-none px-2 h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const n = parseInt(cvDaysDraft);
                        if (!isNaN(n) && n > 0) updateThreshold.mutate(n);
                      }
                      if (e.key === "Escape") setCvDaysEdit(false);
                    }}
                  />
                  <span className="text-xs text-muted-foreground">days</span>
                  <Button
                    size="sm" className="h-8 rounded-none"
                    disabled={updateThreshold.isPending}
                    onClick={() => {
                      const n = parseInt(cvDaysDraft);
                      if (!isNaN(n) && n > 0) updateThreshold.mutate(n);
                    }}
                  >
                    {updateThreshold.isPending ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 rounded-none" onClick={() => setCvDaysEdit(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-2xl font-bold text-teal-700 dark:text-teal-300">{cvDaysThreshold}</span>
                  <span className="text-sm text-muted-foreground">days</span>
                  <Button
                    size="sm" variant="outline" className="h-8 rounded-none"
                    onClick={() => { setCvDaysDraft(String(cvDaysThreshold)); setCvDaysEdit(true); }}
                  >
                    Edit
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agency</TableHead>
                <TableHead>Office</TableHead>
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
                  <TableCell className="text-muted-foreground">{a.country || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{a.contact_email ?? "—"}</TableCell>
                  <TableCell>
                    <span className="inline-flex rounded-full bg-success/15 text-success px-2 py-0.5 text-xs">{a.status}</span>
                  </TableCell>
                  <TableCell>
                    {a.portal_user_id
                      ? <span className="inline-flex rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs">Active</span>
                      : <span className="text-muted-foreground text-xs">No login</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {a.portal_user_id ? (
                        <>
                          <Button
                            variant="ghost" size="icon" title="Reset portal password"
                            onClick={() => setResetTarget({ portalUserId: a.portal_user_id!, name: a.name })}
                          >
                            <KeyRound className="h-4 w-4 text-amber-600" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" title="Remove portal login"
                            onClick={() => removeLogin.mutate({ agencyId: a.id, portalUserId: a.portal_user_id! })}
                            disabled={removeLogin.isPending}
                          >
                            <UserMinus className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost" size="icon" title="Create portal login"
                          onClick={() => { setLoginAgency(a); setLoginEmail(a.contact_email ?? ""); setLoginOfficeId(""); setLoginPassword(""); }}
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
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No agencies yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add agency + login dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) { setAddOpen(false); setAddOfficeId(""); setAddName(""); setAddEmail(""); setAddPassword(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add foreign agency</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Office</Label>
              <Select value={addOfficeId} onValueChange={(v) => { setAddOfficeId(v); if (!addName) setAddName(officeNameById(v)); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an office…" />
                </SelectTrigger>
                <SelectContent>
                  {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Agency name</Label>
              <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Auto-filled from office" />
            </div>
            <div className="space-y-2">
              <Label>Portal email</Label>
              <Input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Portal password <span className="text-muted-foreground text-xs">(min 8 chars)</span></Label>
              <Input type="password" value={addPassword} onChange={(e) => setAddPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setAddOpen(false); setAddOfficeId(""); setAddName(""); setAddEmail(""); setAddPassword(""); }}>Cancel</Button>
            <Button onClick={() => createWithLogin.mutate()} disabled={!addValid || createWithLogin.isPending}>
              {createWithLogin.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => { if (!o) closeReset(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" /> Reset Portal Password
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
              disabled={!resetValid || doResetPw.isPending}
              onClick={() => doResetPw.mutate()}
            >
              {doResetPw.isPending ? "Resetting…" : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create login for existing agency dialog */}
      <Dialog open={!!loginAgency} onOpenChange={(o) => { if (!o) { setLoginAgency(null); setLoginOfficeId(""); setLoginEmail(""); setLoginPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create portal login — {loginAgency?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Select which office this agency will see candidates for, then set login credentials.
          </p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Office</Label>
              <Select value={loginOfficeId} onValueChange={setLoginOfficeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an office…" />
                </SelectTrigger>
                <SelectContent>
                  {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password <span className="text-muted-foreground text-xs">(min 8 chars)</span></Label>
              <Input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setLoginAgency(null); setLoginOfficeId(""); setLoginEmail(""); setLoginPassword(""); }}>Cancel</Button>
            <Button onClick={() => createLogin.mutate()} disabled={!loginValid || createLogin.isPending}>
              {createLogin.isPending ? "Creating…" : "Create login"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
