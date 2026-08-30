import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DarkModeToggle } from "@/components/dark-mode-toggle";

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

  const ROLE_ROUTES: Record<string, string> = {
    admin: "/admin/dashboard",
    manager: "/manager/dashboard",
    staff: "/staff/dashboard",
    agency: "/agency/candidates",
  };
  const ROLE_PRIORITY = ["admin", "manager", "staff", "agency"] as const;

  useEffect(() => {
    if (!loading && user && role) navigate({ to: ROLE_ROUTES[role] ?? "/dashboard" });
  }, [loading, user, role, navigate]);

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
    <div className="min-h-screen grid place-items-center bg-muted/40 p-6 relative">
      <div className="absolute top-4 right-4"><DarkModeToggle /></div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/" className="mx-auto mb-3 flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-primary grid place-items-center">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight text-lg">Staff-Flow</span>
          </Link>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Welcome back. Sign in to your dashboard.  </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              All accounts are created by the administrator.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
