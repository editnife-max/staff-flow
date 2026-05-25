import { Outlet, createFileRoute, Navigate, Link, useNavigate } from "@tanstack/react-router";
import { LogOut, LayoutDashboard, Users, FileText, ChevronDown, Building2, Bell } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/staff")({
  component: StaffLayout,
});

const NAV_TOP = [
  { to: "/staff/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/staff/candidates", label: "HR Pool",   icon: Users,      exact: false },
  { to: "/staff/cv-generator", label: "CV Page", icon: FileText },
];

type Notification = {
  id: string;
  title: string;
  body: string | null;
  candidate_ids: string[];
  read: boolean;
  created_at: string;
};

function StaffLayout() {
  const { role, loading, user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["staff-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("id,title,body,candidate_ids,read,created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as unknown as Notification[];
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const unread = notifications.filter((n) => !n.read).length;

  const markReadMut = useMutation({
    mutationFn: async (ids: string[]) => {
      await supabase
        .from("notifications" as any)
        .update({ read: true })
        .in("id", ids);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-notifications"] }),
  });

  function openNotifs() {
    setNotifOpen(true);
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length > 0) markReadMut.mutate(unreadIds);
  }

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (role !== "staff" && role !== "admin") return <Navigate to="/dashboard" />;
  const initials = (user?.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="px-6 py-3 flex items-center gap-8">
          {/* Logo */}
          <Link to="/staff/candidates" className="flex items-center gap-3 shrink-0">
            <div className="h-9 w-9 rounded-md bg-primary/10 grid place-items-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Staff-Flow</span>
          </Link>

          {/* Nav */}
          <nav className="flex-1 flex flex-wrap items-center gap-x-8 gap-y-2">
            {NAV_TOP.map((n) => {
              const Icon = n.icon;
              return (
                <Link key={n.label} to={n.to}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary py-2"
                  activeProps={{ className: "text-primary font-semibold border-b-2 border-primary py-2 flex items-center gap-2" }}>
                  <Icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          {/* Notification bell */}
          <Popover open={notifOpen} onOpenChange={(o) => { if (o) openNotifs(); else setNotifOpen(false); }}>
            <PopoverTrigger asChild>
              <button className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center leading-none">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="text-sm font-semibold">Notifications</span>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      const ids = notifications.filter((n) => !n.read).map((n) => n.id);
                      if (ids.length > 0) markReadMut.mutate(ids);
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-[360px] overflow-y-auto divide-y">
                {notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications yet.</p>
                ) : notifications.map((n) => (
                  <div key={n.id} className={cn(
                    "px-4 py-3 text-sm",
                    !n.read && "bg-primary/5",
                  )}>
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                      <div className={cn("flex-1", n.read && "pl-3.5")}>
                        <p className="font-medium leading-snug">{n.title}</p>
                        {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                        {n.candidate_ids?.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {n.candidate_ids.length} candidate{n.candidate_ids.length !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

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
