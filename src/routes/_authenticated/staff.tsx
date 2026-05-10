import { Outlet, createFileRoute, Navigate, Link, useNavigate } from "@tanstack/react-router";
import {
  LogOut, LayoutDashboard, Building2, Users, Handshake, Briefcase,
  ArrowLeftRight, FileBadge, UserCog, ChevronDown, Home,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/staff")({
  component: StaffLayout,
});

const NAV_TOP = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/staff/candidates", label: "HR Pool", icon: Users, exact: false },
];

const NAV_DISABLED_TOP = [
  { label: "Organizations", icon: Building2 },
  { label: "Partnership Contracts", icon: Handshake },
  { label: "Employment Requests", icon: Briefcase },
  { label: "Worker Transfer Contracts", icon: ArrowLeftRight },
];

const NAV_DISABLED_BOTTOM = [
  { label: "Update License and Info", icon: FileBadge },
  { label: "Users Management", icon: UserCog },
];

function StaffLayout() {
  const { role, loading, user, signOut } = useAuth();
  const navigate = useNavigate();
  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (role !== "staff" && role !== "admin") return <Navigate to="/dashboard" />;
  const initials = (user?.email ?? "U").slice(0, 2).toUpperCase();
  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="px-6 py-3 flex items-start gap-8">
          {/* Logo block */}
          <Link to="/staff/candidates" className="flex items-center gap-3 shrink-0 pt-1">
            <div className="flex flex-col items-center leading-none">
              <span className="text-xs tracking-[0.3em] text-primary font-bold">مساند</span>
              <span className="text-[10px] tracking-[0.25em] text-muted-foreground mt-0.5">MUSANED</span>
            </div>
            <span className="h-10 w-px bg-border" />
            <div className="h-9 w-9 rounded-md bg-primary/10 grid place-items-center">
              <Home className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-muted-foreground">AR</span>
          </Link>

          {/* Nav columns */}
          <nav className="flex-1 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
              {NAV_TOP.map((n) => {
                const Icon = n.icon;
                return (
                  <Link
                    key={n.label}
                    to={n.to}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary data-[status=active]:text-primary data-[status=active]:font-semibold data-[status=active]:border-b-2 data-[status=active]:border-primary py-2"
                    activeProps={{ className: "text-primary font-semibold border-b-2 border-primary py-2 flex items-center gap-2" }}
                  >
                    <Icon className="h-4 w-4" />
                    {n.label}
                  </Link>
                );
              })}
              {NAV_DISABLED_TOP.map((n) => {
                const Icon = n.icon;
                return (
                  <span key={n.label} className="flex items-center gap-2 text-sm text-muted-foreground/60 cursor-not-allowed py-2">
                    <Icon className="h-4 w-4" />
                    {n.label}
                  </span>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
              {NAV_DISABLED_BOTTOM.map((n) => {
                const Icon = n.icon;
                return (
                  <span key={n.label} className="flex items-center gap-2 text-sm text-muted-foreground/60 cursor-not-allowed">
                    <Icon className="h-4 w-4" />
                    {n.label}
                  </span>
                );
              })}
            </div>
          </nav>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 shrink-0 pt-1">
                <Avatar className="h-9 w-9 bg-muted">
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
