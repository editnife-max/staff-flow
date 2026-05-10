import { Outlet, createFileRoute, Navigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, Globe2, ClipboardList, CreditCard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/manager")({
  component: ManagerLayout,
});

const items = [
  { title: "Dashboard", url: "/manager/dashboard", icon: LayoutDashboard },
  { title: "Staff", url: "/manager/staff", icon: Users },
  { title: "Foreign Agencies", url: "/manager/agencies", icon: Globe2 },
  { title: "Candidates", url: "/manager/candidates", icon: ClipboardList },
  { title: "Subscription", url: "/manager/subscription", icon: CreditCard },
];

function ManagerLayout() {
  const { role, loading } = useAuth();
  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (role !== "manager" && role !== "admin") return <Navigate to="/dashboard" />;
  return (
    <AppShell items={items} groupLabel="Manager">
      <Outlet />
    </AppShell>
  );
}
