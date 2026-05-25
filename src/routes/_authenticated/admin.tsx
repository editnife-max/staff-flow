import { Outlet, createFileRoute, Navigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, ShieldCheck, Bell, CreditCard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const items = [
  { title: "Dashboard",     url: "/admin/dashboard",     icon: LayoutDashboard },
  { title: "Managers",      url: "/admin/managers",      icon: Users },
  { title: "Admins",        url: "/admin/admins",        icon: ShieldCheck },
  { title: "Subscriptions", url: "/admin/subscriptions", icon: Bell },
  { title: "Payments",      url: "/admin/payments",      icon: CreditCard },
];

function AdminLayout() {
  const { role, loading } = useAuth();
  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (role !== "admin") return <Navigate to="/dashboard" />;
  return (
    <AppShell items={items} groupLabel="Admin">
      <Outlet />
    </AppShell>
  );
}