import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { recordStaffLogin } from "@/lib/staff-attendance.functions";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Staff-Flow Agency" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const doRecordStaffLogin = useServerFn(recordStaffLogin);

  const ROLE_ROUTES: Record<string, string> = {
    admin: "/admin/dashboard",
    manager: "/manager/dashboard",
    staff: "/staff/dashboard",
    agency: "/agency/candidates",
  };
  const ROLE_PRIORITY = ["admin", "manager", "staff", "agency"] as const;

  useEffect(() => {
    if (!loading && user && role && !submitting) navigate({ to: ROLE_ROUTES[role] ?? "/dashboard" });
  }, [loading, user, role, submitting, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }
    const userId = signInData.user?.id;
    if (userId) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (!roleData || roleData.length === 0) {
        await supabase.auth.signOut();
        setSubmitting(false);
        toast.error("Your account has been deactivated. Contact your administrator.");
        return;
      }
      const isStaff = roleData.some((rd) => rd.role === "staff");
      if (isStaff) {
        // Run the full attendance check: backfills missed days, counts unexcused
        // incidents, and auto-suspends if the threshold (3) is reached.
        const { isSuspended } = await doRecordStaffLogin();
        if (isSuspended) {
          await supabase.auth.signOut();
          setSubmitting(false);
          toast.error("Your account has been suspended. Contact your manager.");
          return;
        }
      }
      const resolved = ROLE_PRIORITY.find((r) => roleData.some((rd) => rd.role === r));
      setSubmitting(false);
      toast.success("Welcome back!");
      navigate({ to: resolved ? (ROLE_ROUTES[resolved] ?? "/dashboard") : "/dashboard" });
      return;
    }
    setSubmitting(false);
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-background">
      <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-primary text-primary-foreground shadow-sm">
            <Building2 className="h-4 w-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Staff-Flow</span>
        </Link>
        <DarkModeToggle className="inline-grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground" />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 text-center">
            <h1 className="text-[32px] font-semibold leading-tight tracking-tight">Sign in</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">Welcome back. Sign in to your dashboard.</p>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  className="h-11 rounded-xl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="h-11 rounded-xl"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="h-11 w-full rounded-xl text-[15px]" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            All accounts are created by the administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
