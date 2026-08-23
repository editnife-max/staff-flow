import { Outlet, createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  // Only block rendering during the very first auth check (no user known yet).
  // Don't unmount children on token-refresh events — that causes a full page flash.
  if (loading && !user) {
    return (
      <div className="min-h-screen grid place-items-center bg-muted/40">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  return <Outlet />;
}
