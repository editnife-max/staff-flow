import { Outlet, createFileRoute, Navigate, Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Globe2, ClipboardList, CreditCard,
  MapPin, FileText, BookImage, Bell, CheckCircle2, Building2, LogOut, ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { confirmInvoicePayment } from "@/lib/invoice.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/manager")({
  component: ManagerLayout,
});

const NAV_ITEMS = [
  { to: "/manager/dashboard",    label: "Dashboard",        icon: LayoutDashboard },
  { to: "/manager/staff",        label: "Staff",            icon: Users },
  { to: "/manager/agencies",     label: "Foreign Agencies", icon: Globe2 },
  { to: "/manager/candidates",   label: "Candidates",       icon: ClipboardList },
  { to: "/manager/subscription", label: "Subscription",     icon: CreditCard },
  { to: "/manager/assignments",  label: "Assignments",      icon: MapPin },
  { to: "/manager/invoice",      label: "Invoice",          icon: FileText },
  { to: "/manager/cv-generator", label: "CV Page",          icon: BookImage },
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

  const [open, setOpen]               = useState(false);
  const [activeNotif, setActiveNotif] = useState<InvoiceNotif | null>(null);

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

  const unread = notifications.filter((n) => !n.read).length;

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
          <div className="px-4 py-3 border-b text-sm font-semibold">Invoice Payments</div>
          <div className="max-h-[320px] overflow-y-auto divide-y">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No payment notifications.</p>
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
    </>
  );
}

function ManagerLayout() {
  const { role, loading, user, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (role !== "manager" && role !== "admin") return <Navigate to="/dashboard" />;

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
