import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardRouter,
});

function DashboardRouter() {
  const { role, loading } = useAuth();
  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (role === "manager" || role === "admin") return <Navigate to="/manager/dashboard" />;
  if (role === "staff") return <Navigate to="/staff/dashboard" />;
  if (role === "agency") return <Navigate to="/manager/candidates" />;
  return (
    <div className="min-h-screen grid place-items-center p-8">
      <div className="text-center">
        <h1 className="text-xl font-semibold">No role assigned</h1>
        <p className="text-muted-foreground mt-2">Contact your administrator.</p>
      </div>
    </div>
  );
}
