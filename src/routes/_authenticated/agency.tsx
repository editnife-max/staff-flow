import { Outlet, createFileRoute, Navigate, Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Users, ChevronDown, Building2, Bell, Languages } from "lucide-react";
import { useState, createContext, useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agency")({
  component: AgencyLayout,
});

export type Lang = "en" | "ar";
export const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "en",
  setLang: () => {},
});

const NAV = [
  { to: "/agency/candidates", label: "Candidates", icon: Users },
];

type Notification = {
  id: string;
  title: string;
  body: string | null;
  candidate_ids: string[];
  read: boolean;
  status: string;
  created_at: string;
};

type CandidatePreview = {
  id: string;
  full_name: string;
  photo_url: string | null;
  occupation: string | null;
  age: number | null;
  gender: string | null;
  religion: string | null;
  marital_status: string | null;
  experience: string | null;
};

function AgencyLayout() {
  const { role, loading, user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [lang, setLang] = useState<Lang>("ar");
  const [notifOpen, setNotifOpen] = useState(false);
  const [activeNotif, setActiveNotif] = useState<Notification | null>(null);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["agency-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("id,title,body,candidate_ids,read,status,created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as unknown as Notification[];
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const unread = notifications.filter((n) => !n.read).length;

  const { data: candidatePreviews = [] } = useQuery<CandidatePreview[]>({
    queryKey: ["agency-notif-candidates", activeNotif?.id],
    queryFn: async () => {
      if (!activeNotif?.candidate_ids?.length) return [];
      const { data, error } = await supabase
        .from("candidates")
        .select("id,full_name,photo_url,occupation,age,gender,religion,marital_status,experience")
        .in("id", activeNotif.candidate_ids);
      if (error) throw error;
      return data as CandidatePreview[];
    },
    enabled: !!activeNotif,
  });

  const markReadMut = useMutation({
    mutationFn: async (ids: string[]) => {
      await supabase.from("notifications" as any).update({ read: true }).in("id", ids);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agency-notifications"] }),
  });

  function openNotifs() {
    setNotifOpen(true);
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length) markReadMut.mutate(unreadIds);
  }

  function openDetail(n: Notification) {
    setActiveNotif(n);
  }

  function closeDetail() {
    setActiveNotif(null);
  }

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (role !== "agency") return <Navigate to="/dashboard" />;
  const initials = (user?.email ?? "A").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="px-6 py-3 flex items-center gap-8">
          <Link to="/agency/candidates" className="flex items-center gap-3 shrink-0">
            <div className="h-9 w-9 rounded-md bg-primary/10 grid place-items-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Staff-Flow</span>
          </Link>

          <nav className="flex-1 flex flex-wrap items-center gap-x-8 gap-y-2">
            {NAV.map((n) => {
              const Icon = n.icon;
              return (
                <Link
                  key={n.label}
                  to={n.to}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary py-2"
                  activeProps={{ className: "text-primary font-semibold border-b-2 border-primary py-2 flex items-center gap-2" }}
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          {/* Language toggle */}
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 border rounded-md transition-colors",
              lang === "ar"
                ? "bg-primary text-primary-foreground border-primary"
                : "text-muted-foreground hover:text-foreground border-border hover:bg-muted",
            )}
            title="Toggle Arabic / English"
          >
            <Languages className="h-3.5 w-3.5" />
            {lang === "ar" ? "EN" : "AR"}
          </button>

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
              </div>
              <div className="max-h-[360px] overflow-y-auto divide-y">
                {notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications yet.</p>
                ) : notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => { setNotifOpen(false); openDetail(n); }}
                    className={cn(
                      "w-full text-left px-4 py-3 text-sm hover:bg-muted/60 transition-colors",
                      !n.read && "bg-primary/5",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                      <div className={cn("flex-1", n.read && "pl-3.5")}>
                        <p className="font-medium leading-snug">{n.title}</p>
                        {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

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

      <main className="flex-1 p-6">
        <LangContext.Provider value={{ lang, setLang }}>
          <Outlet />
        </LangContext.Provider>
      </main>

      <footer className="border-t bg-background">
        <div className="px-6 py-4 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <div>© {new Date().getFullYear()} Staff-Flow Agency. All rights reserved.</div>
        </div>
      </footer>

      {/* Notification detail dialog */}
      <Dialog open={!!activeNotif} onOpenChange={(o) => { if (!o) closeDetail(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{activeNotif?.title}</DialogTitle>
            {activeNotif?.body && (
              <p className="text-sm text-muted-foreground mt-1 bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
                <span className="font-medium text-destructive">Reason: </span>{activeNotif.body}
              </p>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {candidatePreviews.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading candidates…</p>
            ) : candidatePreviews.map((c) => (
              <div key={c.id} className="flex items-center gap-3 border rounded-md p-3">
                <Avatar className="h-10 w-10 shrink-0">
                  {c.photo_url && <AvatarImage src={c.photo_url} alt={c.full_name} />}
                  <AvatarFallback className="text-xs">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight truncate">{c.full_name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {[c.occupation, c.gender, c.religion, c.marital_status, c.experience, c.age ? `Age ${c.age}` : null]
                      .filter(Boolean)
                      .map((v, i) => (
                        <span key={i} className="text-xs text-muted-foreground">{v}</span>
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 flex justify-end">
            <Button variant="ghost" onClick={closeDetail}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
