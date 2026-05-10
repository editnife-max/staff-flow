import { Outlet, createFileRoute, Navigate, Link, useNavigate } from "@tanstack/react-router";
import { Building2, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/staff")({
  component: StaffLayout,
});

function StaffLayout() {
  const { role, loading, user, signOut } = useAuth();
  const navigate = useNavigate();
  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (role !== "staff" && role !== "admin") return <Navigate to="/dashboard" />;
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="h-14 border-b bg-background flex items-center px-6 gap-3">
        <Link to="/staff/candidates" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-accent grid place-items-center text-accent-foreground">
            <Building2 className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">Staff-Flow</span>
        </Link>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">{user?.email}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </header>
      <main className="p-6"><Outlet /></main>
    </div>
  );
}
