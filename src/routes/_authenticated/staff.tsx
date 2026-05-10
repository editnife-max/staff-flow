import { Outlet, createFileRoute, Navigate } from "@tanstack/react-router";
import { ClipboardList, FileText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/staff")({
  component: StaffLayout,
});

const items = [
  { title: "Candidates", url: "/staff/candidates", icon: ClipboardList },
  { title: "CV Generator", url: "/staff/cv-generator", icon: FileText },
];

function StaffLayout() {
  const { role, loading } = useAuth();
  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (role !== "staff" && role !== "admin") return <Navigate to="/dashboard" />;
  return (
    <AppShell items={items} groupLabel="Staff">
      <Outlet />
    </AppShell>
  );
}
