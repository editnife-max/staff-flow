import { Outlet, createFileRoute, Navigate, Link, useNavigate } from "@tanstack/react-router";
import { LogOut, LayoutDashboard, Users, FileText, ChevronDown, Building2, Bell, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  acceptCandidatesNotification,
  declineCandidatesNotification,
} from "@/lib/notifications.functions";
import { updateCandidateField } from "@/lib/candidates.functions";

export const Route = createFileRoute("/_authenticated/staff")({
  component: StaffLayout,
});

const NAV_TOP = [
  { to: "/staff/dashboard",    label: "Dashboard", icon: LayoutDashboard },
  { to: "/staff/candidates",   label: "HR Pool",   icon: Users,      exact: false },
  { to: "/staff/cv-generator", label: "CV Page",   icon: FileText },
];

type Notification = {
  id: string;
  title: string;
  body: string | null;
  candidate_ids: string[];
  sender_id: string | null;
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
  status: string;
};

const STATUS_BADGE: Record<string, string> = {
  pending:  "bg-muted text-muted-foreground",
  accepted: "bg-emerald-500/15 text-emerald-700",
  declined: "bg-destructive/15 text-destructive",
};

function StaffLayout() {
  const { role, loading, user, signOut } = useAuth();
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const doAccept  = useServerFn(acceptCandidatesNotification);
  const doDecline = useServerFn(declineCandidatesNotification);

  const updateFieldFn = useServerFn(updateCandidateField);

  const [notifOpen, setNotifOpen]         = useState(false);
  const [activeNotif, setActiveNotif]     = useState<Notification | null>(null);
  const [declineMode, setDeclineMode]     = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [activeTasheerCandidateId, setActiveTasheerCandidateId] = useState<string | null>(null);

  // ── Tasheer overdue candidates (computed client-side) ─────────────────────
  const { data: tasheerOverdue = [] } = useQuery<{ id: string; full_name: string; tasheer_date: string | null }[]>({
    queryKey: ["staff-tasheer-overdue"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("candidates")
        .select("id,full_name,tasheer_date")
        .eq("tasheer_status", "Booked")
        .lt("tasheer_date", today)
        .not("tasheer_date", "is", null);
      if (error) throw error;
      return data as { id: string; full_name: string; tasheer_date: string | null }[];
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const activeTasheerCandidate = tasheerOverdue.find((x) => x.id === activeTasheerCandidateId) ?? null;

  const tasheerMut = useMutation({
    mutationFn: (id: string) =>
      updateFieldFn({ data: { id, field: "tasheer_status", value: "Done" } }),
    onSuccess: () => {
      toast.success("Tasheer marked as Done");
      setActiveTasheerCandidateId(null);
      qc.invalidateQueries({ queryKey: ["staff-tasheer-overdue"] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["staff-dashboard-candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Notifications list ────────────────────────────────────────────────────
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["staff-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("id,title,body,candidate_ids,sender_id,read,status,created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as unknown as Notification[];
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const unread = notifications.filter((n) => !n.read).length + tasheerOverdue.length;

  // ── Candidate previews for active notification ────────────────────────────
  const { data: candidatePreviews = [] } = useQuery<CandidatePreview[]>({
    queryKey: ["notif-candidates", activeNotif?.id],
    queryFn: async () => {
      if (!activeNotif?.candidate_ids?.length) return [];
      const { data, error } = await supabase
        .from("candidates")
        .select("id,full_name,photo_url,occupation,age,gender,religion,marital_status,experience,status")
        .in("id", activeNotif.candidate_ids);
      if (error) throw error;
      return data as CandidatePreview[];
    },
    enabled: !!activeNotif,
  });

  // ── Mark read ─────────────────────────────────────────────────────────────
  const markReadMut = useMutation({
    mutationFn: async (ids: string[]) => {
      await supabase.from("notifications" as any).update({ read: true }).in("id", ids);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-notifications"] }),
  });

  function openNotifs() {
    setNotifOpen(true);
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length) markReadMut.mutate(unreadIds);
  }

  function openDetail(n: Notification) {
    setActiveNotif(n);
    setDeclineMode(false);
    setDeclineReason("");
  }

  function closeDetail() {
    setActiveNotif(null);
    setDeclineMode(false);
    setDeclineReason("");
  }

  // ── Accept ────────────────────────────────────────────────────────────────
  const acceptMut = useMutation({
    mutationFn: () => doAccept({
      data: {
        notificationId: activeNotif!.id,
        candidateIds:   activeNotif!.candidate_ids,
      },
    }),
    onSuccess: () => {
      toast.success("Candidates moved to processing");
      qc.invalidateQueries({ queryKey: ["staff-notifications"] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      closeDetail();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Decline ───────────────────────────────────────────────────────────────
  const declineMut = useMutation({
    mutationFn: () => doDecline({
      data: {
        notificationId: activeNotif!.id,
        agencyUserId:   activeNotif!.sender_id!,
        candidateIds:   activeNotif!.candidate_ids,
        reason:         declineReason.trim(),
      },
    }),
    onSuccess: () => {
      toast.success("Decline reason sent to agency");
      qc.invalidateQueries({ queryKey: ["staff-notifications"] });
      closeDetail();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (role !== "staff" && role !== "admin") return <Navigate to="/dashboard" />;
  const initials = (user?.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="px-6 py-3 flex items-center gap-8">
          <Link to="/staff/candidates" className="flex items-center gap-3 shrink-0">
            <div className="h-9 w-9 rounded-md bg-primary/10 grid place-items-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Staff-Flow</span>
          </Link>

          <nav className="flex-1 flex flex-wrap items-center gap-x-8 gap-y-2">
            {NAV_TOP.map((n) => {
              const Icon = n.icon;
              return (
                <Link key={n.label} to={n.to}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary py-2"
                  activeProps={{ className: "text-primary font-semibold border-b-2 border-primary py-2 flex items-center gap-2" }}>
                  <Icon className="h-4 w-4" />{n.label}
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
              </div>
              <div className="max-h-[360px] overflow-y-auto divide-y">
                {tasheerOverdue.length > 0 && (
                  <>
                    <div className="px-4 py-1.5 bg-amber-50 dark:bg-amber-950/30">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Tasheer Overdue</span>
                    </div>
                    {tasheerOverdue.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setNotifOpen(false); setActiveTasheerCandidateId(c.id); }}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-muted/60 transition-colors bg-amber-50/40 dark:bg-amber-950/10"
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium leading-snug">{c.full_name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Tasheer booked{" "}
                              {c.tasheer_date
                                ? new Date(c.tasheer_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
                                : ""}
                              {" "}— date has passed
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {notifications.length === 0 && tasheerOverdue.length === 0 ? (
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
                        {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{n.body}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(n.created_at).toLocaleString()}
                          </p>
                          {n.status !== "pending" && (
                            <span className={cn("text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none capitalize", STATUS_BADGE[n.status])}>
                              {n.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
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

      {/* Tasheer overdue dialog */}
      <Dialog open={!!activeTasheerCandidateId} onOpenChange={(o) => { if (!o) setActiveTasheerCandidateId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tasheer Overdue</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">{activeTasheerCandidate?.full_name}</span>'s Tasheer was booked for{" "}
            <span className="font-medium text-foreground">
              {activeTasheerCandidate?.tasheer_date
                ? new Date(activeTasheerCandidate.tasheer_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                : "unknown date"}
            </span>{" "}
            and the date has passed. Was the Tasheer completed?
          </p>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setActiveTasheerCandidateId(null)}>No</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => activeTasheerCandidateId && tasheerMut.mutate(activeTasheerCandidateId)}
              disabled={tasheerMut.isPending}
            >
              {tasheerMut.isPending ? "Saving…" : "Yes — Mark Done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notification detail dialog */}
      <Dialog open={!!activeNotif} onOpenChange={(o) => { if (!o) closeDetail(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{activeNotif?.title}</DialogTitle>
            {activeNotif?.body && (
              <p className="text-sm text-muted-foreground mt-1">{activeNotif.body}</p>
            )}
          </DialogHeader>

          {/* Already declined */}
          {activeNotif?.status !== "pending" ? (
            <div className="rounded-md px-4 py-3 text-sm font-medium text-center bg-destructive/10 text-destructive">
              ✗ You declined these candidates.
            </div>
          ) : (
            <>
              {/* Candidate cards */}
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

              {/* Decline reason input */}
              {declineMode && (
                <div className="space-y-2 border-t pt-4">
                  <Label>Reason for declining</Label>
                  <Textarea
                    placeholder="Explain why you're declining these candidates…"
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    rows={3}
                    autoFocus
                  />
                </div>
              )}

              <DialogFooter className="border-t pt-4 gap-2">
                {!declineMode ? (
                  <>
                    <Button variant="ghost" onClick={closeDetail}>Cancel</Button>
                    <Button
                      variant="outline"
                      className="text-destructive border-destructive/40 hover:bg-destructive/5"
                      onClick={() => setDeclineMode(true)}
                    >
                      <XCircle className="h-4 w-4 mr-1.5" /> Decline
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => acceptMut.mutate()}
                      disabled={acceptMut.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      {acceptMut.isPending ? "Accepting…" : "Accept"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => setDeclineMode(false)}>Back</Button>
                    <Button
                      variant="destructive"
                      onClick={() => declineMut.mutate()}
                      disabled={!declineReason.trim() || declineMut.isPending}
                    >
                      {declineMut.isPending ? "Sending…" : "Confirm Decline"}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
