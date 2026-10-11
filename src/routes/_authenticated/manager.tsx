import { Outlet, createFileRoute, Navigate, Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Globe2, ClipboardList, CreditCard,
  MapPin, FileText, Bell, CheckCircle2, Building2, LogOut, ChevronDown, Activity, BookOpen,
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { confirmInvoicePayment } from "@/lib/invoice.functions";
import { updateCandidateField } from "@/lib/candidates.functions";
import { backfillTeamAbsents } from "@/lib/staff-attendance.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { TicketAnnouncementBanner } from "@/components/ticket-announcement-banner";

export const Route = createFileRoute("/_authenticated/manager")({
  component: ManagerLayout,
});

const NAV_ITEMS = [
  { to: "/manager/dashboard",    label: "Dashboard",        icon: LayoutDashboard },
  { to: "/manager/staff",          label: "Staff",            icon: Users },
  { to: "/manager/staff-activity", label: "Staff Activity",   icon: Activity },
  { to: "/manager/agencies",     label: "Foreign Agencies", icon: Globe2 },
  { to: "/manager/candidates",   label: "Candidates",       icon: ClipboardList },
  { to: "/manager/subscription", label: "Subscription",     icon: CreditCard },
  { to: "/manager/assignments",  label: "Assignments",      icon: MapPin },
  { to: "/manager/invoice",      label: "Invoice",          icon: FileText },
  { to: "/manager/cv-generator", label: "CV Page",          icon: BookOpen },
];

type InvoiceNotif = {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
  status: string;
  reference_id: string | null;
  created_at: string;
  type: string | null;
};

function ManagerBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const doConfirm = useServerFn(confirmInvoicePayment);
  const updateFieldFn = useServerFn(updateCandidateField);

  const [open, setOpen]               = useState(false);
  const [activeNotif, setActiveNotif] = useState<InvoiceNotif | null>(null);
  const [activeTasheerCandidateId, setActiveTasheerCandidateId] = useState<string | null>(null);
  const [tasheerStep, setTasheerStep] = useState<"overdue" | "passport">("overdue");

  // ── Tasheer overdue candidates ────────────────────────────────────────────
  const { data: tasheerOverdue = [] } = useQuery<{ id: string; full_name: string; tasheer_date: string | null }[]>({
    queryKey: ["manager-tasheer-overdue"],
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
    mutationFn: async ({ id, passportAccepted }: { id: string; passportAccepted: boolean }) => {
      if (passportAccepted) {
        await updateFieldFn({ data: { id, field: "tasheer_status", value: "Done" } });
        await updateFieldFn({ data: { id, field: "passport_accepted", value: "true" } });
        await updateFieldFn({ data: { id, field: "wokala_status", value: "Unpaid" } });
        await updateFieldFn({ data: { id, field: "visa_status", value: "Ready for embassy" } });
      } else {
        await updateFieldFn({ data: { id, field: "tasheer_status", value: "Done without passport" } });
        await updateFieldFn({ data: { id, field: "passport_accepted", value: "false" } });
        await updateFieldFn({ data: { id, field: "wokala_status", value: "Unpaid" } });
      }
    },
    onSuccess: () => {
      toast.success("Tasheer updated");
      setActiveTasheerCandidateId(null);
      setTasheerStep("overdue");
      qc.invalidateQueries({ queryKey: ["manager-tasheer-overdue"] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["dashboard-candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: notifications = [] } = useQuery<InvoiceNotif[]>({
    queryKey: ["manager-invoice-notifs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("id,title,body,read,status,reference_id,created_at,type")
        .eq("type", "invoice_paid")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as InvoiceNotif[];
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const unread = notifications.filter((n) => !n.read).length + tasheerOverdue.length;

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      await supabase.from("notifications" as any).update({ read: true }).in("id", ids);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manager-invoice-notifs"] }),
  });

  function openBell() {
    setOpen(true);
    const ids = notifications.filter((n) => !n.read).map((n) => n.id);
    if (ids.length) markRead.mutate(ids);
  }

  const confirmMut = useMutation({
    mutationFn: () => doConfirm({ data: { invoiceId: activeNotif!.reference_id! } }),
    onSuccess: () => {
      toast.success("Payment confirmed — agency notified");
      qc.invalidateQueries({ queryKey: ["manager-invoice-notifs"] });
      qc.invalidateQueries({ queryKey: ["manager-invoices"] });
      setActiveNotif(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Popover open={open} onOpenChange={(o) => { if (o) openBell(); else setOpen(false); }}>
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
          <div className="px-4 py-3 border-b text-sm font-semibold">Notifications</div>
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
                    onClick={() => { setOpen(false); setActiveTasheerCandidateId(c.id); }}
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
                {notifications.length > 0 && <div className="border-b" />}
              </>
            )}
            {notifications.length === 0 && tasheerOverdue.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications.</p>
            ) : notifications.map((n) => (
              <button key={n.id} type="button"
                onClick={() => { setOpen(false); setActiveNotif(n); }}
                className={cn("w-full text-left px-4 py-3 text-sm hover:bg-muted/60 transition-colors", !n.read && "bg-primary/5")}>
                <div className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                  <div className={cn("flex-1", n.read && "pl-3.5")}>
                    <p className="font-medium leading-snug">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                      {n.status === "accepted" && (
                        <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-emerald-500/15 text-emerald-700">Confirmed</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={!!activeNotif} onOpenChange={(o) => { if (!o) setActiveNotif(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
          </DialogHeader>
          {activeNotif?.status === "accepted" ? (
            <div className="rounded-md px-4 py-3 text-sm font-medium text-center bg-emerald-500/10 text-emerald-700">
              ✓ You already confirmed this payment.
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{activeNotif?.title}</p>
              {activeNotif?.body && <p className="text-xs text-muted-foreground">Office: {activeNotif.body}</p>}
              <p className="text-sm">Confirm that you have received this payment from the agency?</p>
            </>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActiveNotif(null)}>Close</Button>
            {activeNotif?.status !== "accepted" && activeNotif?.reference_id && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                onClick={() => confirmMut.mutate()}
                disabled={confirmMut.isPending}
              >
                <CheckCircle2 className="h-4 w-4" />
                {confirmMut.isPending ? "Confirming…" : "Confirm Payment"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tasheer overdue dialog */}
      <Dialog open={!!activeTasheerCandidateId} onOpenChange={(o) => { if (!o) { setActiveTasheerCandidateId(null); setTasheerStep("overdue"); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {tasheerStep === "overdue" ? "Tasheer Overdue" : "Passport Accepted?"}
            </DialogTitle>
          </DialogHeader>
          {tasheerStep === "overdue" ? (
            <>
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
                <Button variant="ghost" onClick={() => { setActiveTasheerCandidateId(null); setTasheerStep("overdue"); }}>No</Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setTasheerStep("passport")}
                >
                  Yes
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Tasheer is Done for <span className="font-semibold text-foreground">{activeTasheerCandidate?.full_name}</span>. Is the passport accepted?
              </p>
              <DialogFooter className="gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => activeTasheerCandidateId && tasheerMut.mutate({ id: activeTasheerCandidateId, passportAccepted: false })}
                  disabled={tasheerMut.isPending}
                >
                  {tasheerMut.isPending ? "Saving…" : "No — Not Accepted"}
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => activeTasheerCandidateId && tasheerMut.mutate({ id: activeTasheerCandidateId, passportAccepted: true })}
                  disabled={tasheerMut.isPending}
                >
                  {tasheerMut.isPending ? "Saving…" : "Yes — Accepted"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <TicketAnnouncementBanner />
    </>
  );
}

function ManagerLayout() {
  const { role, loading, user, signOut } = useAuth();
  const navigate = useNavigate();
  const doBackfill = useServerFn(backfillTeamAbsents);

  // Register absent days for all staff once per hour automatically
  useQuery({
    queryKey: ["backfill-absents-shell"],
    queryFn: () => doBackfill(),
    enabled: role === "manager" || role === "admin",
    staleTime: 60 * 60 * 1000,
  });

  // Only block when we have no role yet (initial load). Skip the guard during
  // token-refresh events so the layout stays mounted and pages don't flash.
  if (loading && !role) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!loading && role !== "manager" && role !== "admin") return <Navigate to="/dashboard" />;

  const initials = (user?.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="px-6 py-3 flex items-center gap-8">
          <Link to="/manager/dashboard" className="flex items-center gap-3 shrink-0">
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
          <ManagerBell />

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

      <main className="flex-1 overflow-auto"><Outlet /></main>

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
