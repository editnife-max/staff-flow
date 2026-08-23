import { Outlet, createFileRoute, Navigate, Link, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, ShieldCheck, Bell, CreditCard, Building2, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DarkModeToggle } from "@/components/dark-mode-toggle";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const NAV_ITEMS = [
  { to: "/admin/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { to: "/admin/managers",      label: "Managers",      icon: Users },
  { to: "/admin/admins",        label: "Admins",        icon: ShieldCheck },
  { to: "/admin/subscriptions", label: "Subscriptions", icon: Bell },
  { to: "/admin/payments",      label: "Payments",      icon: CreditCard },
];

function AdminLayout() {
  const { role, loading, user, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading && !role) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!loading && role !== "admin") return <Navigate to="/dashboard" />;

  const initials = (user?.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="px-6 py-3 flex items-center gap-8">
          <Link to="/admin/dashboard" className="flex items-center gap-3 shrink-0">
            <div className="h-9 w-9 rounded-md bg-primary/10 grid place-items-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Staff-Flow</span>
          </Link>

          <nav className="flex-1 flex flex-wrap items-center gap-x-6 gap-y-2">
            {NAV_ITEMS.map((n) => {
              const Icon = n.icon;
              return (
                <Link
                  key={n.label}
                  to={n.to}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary py-2"
                  activeProps={{ className: "text-primary font-semibold border-b-2 border-primary py-2 flex items-center gap-2" }}
                >
                  <Icon className="h-4 w-4" />{n.label}
                </Link>
              );
            })}
          </nav>

          <DarkModeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 shrink-0">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-muted text-muted-foreground text-xs">{initials}</AvatarFallback>
                </Avatar>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem disabled className="text-xs">{user?.email}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 p-6"><Outlet /></main>

      <footer className="border-t bg-background">
        <div className="px-6 py-4 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <div>© {new Date().getFullYear()} Staff-Flow Agency. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <Link to="/about" className="hover:text-foreground">About</Link>
            <Link to="/faq" className="hover:text-foreground">FAQ</Link>
            <Link to="/contact" className="hover:text-foreground">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
