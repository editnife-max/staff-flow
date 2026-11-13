import { Outlet, createFileRoute, Navigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, ShieldCheck, Bell, CreditCard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PageLoader } from "@/components/page-loader";
import { RoleShell, type RoleNavItem } from "@/components/role-shell";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const NAV_ITEMS: RoleNavItem[] = [
  { to: "/admin/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { to: "/admin/managers",      label: "Managers",      icon: Users },
  { to: "/admin/admins",        label: "Admins",        icon: ShieldCheck },
  { to: "/admin/subscriptions", label: "Subscriptions", icon: Bell },
  { to: "/admin/payments",      label: "Payments",      icon: CreditCard },
];

function AdminLayout() {
  const { role, loading } = useAuth();

  if (loading && !role) return <PageLoader />;
  if (!loading && role !== "admin") return <Navigate to="/dashboard" />;

  return (
    <RoleShell homeTo="/admin/dashboard" roleLabel="Administrator" nav={NAV_ITEMS}>
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6">
        <Outlet />
      </div>
    </RoleShell>
  );
}
