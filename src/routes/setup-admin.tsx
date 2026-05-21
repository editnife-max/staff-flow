import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Building2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import fs from "node:fs";
import path from "node:path";

export const Route = createFileRoute("/setup-admin")({
  head: () => ({ meta: [{ title: "Admin Setup — Staff-Flow" }] }),
  component: SetupAdminPage,
});

const EMAIL = "admin00@staffflow.com";
const PASSWORD = "Admin12345!";

const bootstrapAdmin = createServerFn({ method: "POST" }).handler(async () => {
  // Clear any existing admin roles to avoid conflicts
  await supabaseAdmin.from("user_roles").delete().eq("role", "admin");

  // Find or create auth user
  const authList = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const existing = ((authList.data as any)?.users ?? []).find((u: any) => u.email === EMAIL);

  let userId: string;
  if (existing) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password: PASSWORD, email_confirm: true,
    });
    if (error) return { ok: false, message: error.message };
    userId = existing.id;
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: EMAIL, password: PASSWORD, email_confirm: true,
    });
    if (error) return { ok: false, message: error.message };
    userId = data.user.id;
  }

  // Insert admin role
  const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
    user_id: userId, role: "admin", manager_id: null,
  } as never);
  if (roleErr) return { ok: false, message: roleErr.message };

  // Self-delete setup files
  const root = path.resolve(process.cwd());
  for (const f of [
    path.join(root, "src", "routes", "setup-admin.tsx"),
    path.join(root, "scripts", "create-admin.ts"),
    path.join(root, "scripts", "delete-admin.ts"),
  ]) {
    try { fs.unlinkSync(f); } catch { /* already gone */ }
  }

  return { ok: true };
});

function SetupAdminPage() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  async function run() {
    setState("loading");
    try {
      const res = await bootstrapAdmin({});
      if (res.ok) setState("done");
      else { setErrMsg(res.message ?? "Unknown error"); setState("error"); }
    } catch (e: any) {
      setErrMsg(e.message ?? "Unknown error");
      setState("error");
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-primary grid place-items-center">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle>Admin Account Setup</CardTitle>
          <CardDescription>Creates the Admin account (separate from Manager and Staff roles).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-1.5">
            <div><span className="text-muted-foreground">Email:</span> <span className="font-mono font-medium ml-2">{EMAIL}</span></div>
            <div><span className="text-muted-foreground">Password:</span> <span className="font-mono font-medium ml-2">{PASSWORD}</span></div>
            <div><span className="text-muted-foreground">Role:</span> <span className="font-mono font-medium ml-2 text-accent">admin</span></div>
          </div>

          {state === "idle" && (
            <Button className="w-full" onClick={run}>Create Admin Account</Button>
          )}
          {state === "loading" && (
            <Button className="w-full" disabled>Setting up…</Button>
          )}
          {state === "error" && (
            <div className="space-y-3">
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                ✗ {errMsg}
              </div>
              <Button className="w-full" onClick={run}>Retry</Button>
            </div>
          )}
          {state === "done" && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
              <div className="flex items-center gap-2 font-semibold mb-2">
                <ShieldCheck className="h-4 w-4" /> Admin account ready
              </div>
              <p className="text-emerald-700 mb-3">
                Sign in with the credentials above — you will land directly on the Admin Panel.
              </p>
              <a href="/login"
                className="block w-full text-center rounded-md bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 text-sm font-medium transition-colors">
                Go to Login →
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
