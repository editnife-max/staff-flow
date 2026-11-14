import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { PageLoader } from "@/components/page-loader";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardRouter,
});

function DashboardRouter() {
  const { role, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (role === "admin") return <Navigate to="/admin/dashboard" />;
  if (role === "manager") return <Navigate to="/manager/dashboard" />;
  if (role === "staff") return <Navigate to="/staff/dashboard" />;
  if (role === "agency") return <Navigate to="/agency/candidates" />;
  return (
    <div className="min-h-screen grid place-items-center p-8">
      <div className="text-center">
        <h1 className="text-xl font-semibold">No role assigned</h1>
        <p className="text-muted-foreground mt-2">Contact your administrator.</p>
      </div>
    </div>
  );
}
