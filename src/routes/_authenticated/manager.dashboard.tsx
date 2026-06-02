import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  Users, Clock, CheckCircle2, XCircle, AlertTriangle,
  UserPlus, Stethoscope, X, ChevronRight, RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Candidate = Database["public"]["Tables"]["candidates"]["Row"];

export const Route = createFileRoute("/_authenticated/manager/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Staff-Flow" }] }),
  component: ManagerDashboard,
});

const STATUS_CONFIG = [
  {
    key: "available",
    label: "Available",
    icon: Users,
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    icon_bg: "bg-emerald-100 dark:bg-emerald-900/60",
    icon_color: "text-emerald-600 dark:text-emerald-400",
    value_color: "text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  {
    key: "processing",
    label: "Processing",
    icon: Clock,
    bg: "bg-amber-50 dark:bg-amber-950/40",
    icon_bg: "bg-amber-100 dark:bg-amber-900/60",
    icon_color: "text-amber-600 dark:text-amber-400",
    value_color: "text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  {
    key: "arrived",
    label: "Arrived",
    icon: CheckCircle2,
    bg: "bg-blue-50 dark:bg-blue-950/40",
    icon_bg: "bg-blue-100 dark:bg-blue-900/60",
    icon_color: "text-blue-600 dark:text-blue-400",
    value_color: "text-blue-700 dark:text-blue-300",
    bar: "bg-blue-500",
  },
  {
    key: "canceled",
    label: "Canceled",
    icon: XCircle,
    bg: "bg-red-50 dark:bg-red-950/40",
    icon_bg: "bg-red-100 dark:bg-red-900/60",
    icon_color: "text-red-600 dark:text-red-400",
    value_color: "text-red-700 dark:text-red-300",
    bar: "bg-red-500",
  },
  {
    key: "returned",
    label: "Returned",
    icon: RotateCcw,
    bg: "bg-orange-50 dark:bg-orange-950/40",
    icon_bg: "bg-orange-100 dark:bg-orange-900/60",
    icon_color: "text-orange-600 dark:text-orange-400",
    value_color: "text-orange-700 dark:text-orange-300",
    bar: "bg-orange-500",
  },
] as const;

const STATUS_PILL: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  processing: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  arrived: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  canceled: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  returned: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
};

function ManagerDashboard() {
  const { user } = useAuth();
  const [medOpen, setMedOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [tasheerOpen, setTasheerOpen] = useState(false);
  const [tasheerDismissed, setTasheerDismissed] = useState(false);
  const [cocNotDoneOpen, setCocNotDoneOpen] = useState(false);
  const [cocNotDoneDismissed, setCocNotDoneDismissed] = useState(false);
  const [medNotFitOpen, setMedNotFitOpen] = useState(false);
  const [medNotFitDismissed, setMedNotFitDismissed] = useState(false);
  const [cocDoneMedNotFitOpen, setCocDoneMedNotFitOpen] = useState(false);
  const [cocDoneMedNotFitDismissed, setCocDoneMedNotFitDismissed] = useState(false);
  const [visaReturnedOpen, setVisaReturnedOpen] = useState(false);
  const [visaReturnedDismissed, setVisaReturnedDismissed] = useState(false);

  const { data: candidates = [] } = useQuery({
    queryKey: ["dashboard-candidates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Candidate[];
    },
  });

  const counts = {
    available: candidates.filter((c) => c.status === "available").length,
    processing: candidates.filter((c) => c.status === "processing").length,
    arrived: candidates.filter((c) => c.status === "arrived").length,
    canceled: candidates.filter((c) => c.status === "canceled").length,
    returned: candidates.filter((c) => c.status === "returned").length,
  };
  const total = candidates.length;

  const medExpired = candidates.filter((c) => c.medical_status === "Expired");
  const tasheerDoneWokalaUnpaid = candidates.filter(
    (c) => c.status === "processing" && c.tasheer_status === "Done" && c.wokala_status === "Unpaid",
  );
  const cocNotDone = candidates.filter((c) => c.coc_status === "Not Done");
  const medNotFit = candidates.filter((c) => c.medical_status === "Not Fit");
  const cocDoneMedNotFit = candidates.filter((c) => c.coc_status === "Done" && c.medical_status === "Not Fit");
  const visaReturned = candidates.filter((c) => c.visa_status === "Returned");
  const recent = candidates.slice(0, 12);

  return (
    <div className="space-y-6 mx-[79.6px]">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <Button asChild size="sm" className="gap-2 text-xs h-8 rounded-none">
          <Link to="/manager/candidates">
            <UserPlus className="h-4 w-4" /> Manage Candidates
          </Link>
        </Button>
      </div>

      {/* Medical Expired Banner */}
      {medExpired.length > 0 && !dismissed && (
        <div
          className="flex items-center justify-between gap-3 rounded-none border border-orange-300 bg-orange-50 dark:bg-orange-950/40 dark:border-orange-700 px-4 py-3 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors"
          onClick={() => setMedOpen(true)}
        >
          <div className="flex items-center gap-3">
            <Stethoscope className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                Medical Expired — {medExpired.length} candidate{medExpired.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400">
                Click to view candidates with expired medical status
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ChevronRight className="h-4 w-4 text-orange-500" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
              className="p-1 rounded-none text-orange-400 hover:text-orange-700 hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tasheer Done + Wokala Unpaid Banner */}
      {tasheerDoneWokalaUnpaid.length > 0 && !tasheerDismissed && (
        <div
          className="flex items-center justify-between gap-3 rounded-none border border-violet-300 bg-violet-50 dark:bg-violet-950/40 dark:border-violet-700 px-4 py-3 cursor-pointer hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
          onClick={() => setTasheerOpen(true)}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-violet-600 dark:text-violet-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">
                Tasheer Done but Wokala Unpaid — {tasheerDoneWokalaUnpaid.length} candidate{tasheerDoneWokalaUnpaid.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-violet-600 dark:text-violet-400">
                Click to view candidates with Tasheer Done but Wokala not yet paid
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ChevronRight className="h-4 w-4 text-violet-500" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setTasheerDismissed(true); }}
              className="p-1 rounded-none text-violet-400 hover:text-violet-700 hover:bg-violet-200 dark:hover:bg-violet-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* COC Not Done Banner */}
      {cocNotDone.length > 0 && !cocNotDoneDismissed && (
        <div
          className="flex items-center justify-between gap-3 rounded-none border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/40 dark:border-yellow-700 px-4 py-3 cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/40 transition-colors"
          onClick={() => setCocNotDoneOpen(true)}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                COC Not Done — {cocNotDone.length} candidate{cocNotDone.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                Click to view candidates with COC status Not Done
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ChevronRight className="h-4 w-4 text-yellow-500" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCocNotDoneDismissed(true); }}
              className="p-1 rounded-none text-yellow-400 hover:text-yellow-700 hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Medical Not Fit Banner */}
      {medNotFit.length > 0 && !medNotFitDismissed && (
        <div
          className="flex items-center justify-between gap-3 rounded-none border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-700 px-4 py-3 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
          onClick={() => setMedNotFitOpen(true)}
        >
          <div className="flex items-center gap-3">
            <Stethoscope className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                Medical Not Fit — {medNotFit.length} candidate{medNotFit.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">
                Click to view candidates with Medical status Not Fit
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ChevronRight className="h-4 w-4 text-red-500" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMedNotFitDismissed(true); }}
              className="p-1 rounded-none text-red-400 hover:text-red-700 hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* COC Done + Medical Not Fit Banner */}
      {cocDoneMedNotFit.length > 0 && !cocDoneMedNotFitDismissed && (
        <div
          className="flex items-center justify-between gap-3 rounded-none border border-rose-300 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-700 px-4 py-3 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
          onClick={() => setCocDoneMedNotFitOpen(true)}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">
                COC Done — Medical Not Fit — {cocDoneMedNotFit.length} candidate{cocDoneMedNotFit.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Click to view candidates with COC Done but Medical Not Fit
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ChevronRight className="h-4 w-4 text-rose-500" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCocDoneMedNotFitDismissed(true); }}
              className="p-1 rounded-none text-rose-400 hover:text-rose-700 hover:bg-rose-200 dark:hover:bg-rose-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Visa Returned Banner */}
      {visaReturned.length > 0 && !visaReturnedDismissed && (
        <div
          className="flex items-center justify-between gap-3 rounded-none border border-sky-300 bg-sky-50 dark:bg-sky-950/40 dark:border-sky-700 px-4 py-3 cursor-pointer hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors"
          onClick={() => setVisaReturnedOpen(true)}
        >
          <div className="flex items-center gap-3">
            <RotateCcw className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-sky-800 dark:text-sky-200">
                Visa Returned — {visaReturned.length} candidate{visaReturned.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-sky-600 dark:text-sky-400">
                Click to view candidates with Visa status Returned
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ChevronRight className="h-4 w-4 text-sky-500" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setVisaReturnedDismissed(true); }}
              className="p-1 rounded-none text-sky-400 hover:text-sky-700 hover:bg-sky-200 dark:hover:bg-sky-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATUS_CONFIG.map((s) => {
          const count = counts[s.key];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const Icon = s.icon;
          return (
            <Card key={s.key} className={cn("rounded-none border-0 shadow-sm", s.bg)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={cn("h-10 w-10 rounded-none grid place-items-center", s.icon_bg)}>
                    <Icon className={cn("h-5 w-5", s.icon_color)} />
                  </div>
                  <span className={cn("text-3xl font-bold tracking-tight", s.value_color)}>{count}</span>
                </div>
                <p className="text-sm font-medium text-foreground/80 mb-2">{s.label}</p>
                <div className="h-1.5 rounded-none bg-black/10 dark:bg-white/10">
                  <div className={cn("h-full rounded-none transition-all", s.bar)} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{pct}% of total</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Requests */}
      <Card className="rounded-none">
        <CardHeader className="pb-3 px-5 pt-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Requests</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs h-7 rounded-none gap-1">
              <Link to="/manager/candidates">View all <ChevronRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {recent.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No candidates yet.
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-border">
              {recent.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                    <AvatarFallback className="text-[11px] rounded-none">
                      {c.full_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[c.occupation, c.country].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-none capitalize", STATUS_PILL[c.status] ?? "bg-muted text-muted-foreground")}>
                      {c.status}
                    </span>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Medical Expired Dialog */}
      <Dialog open={medOpen} onOpenChange={setMedOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <AlertTriangle className="h-5 w-5" />
              Medical Expired ({medExpired.length})
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-0 divide-y divide-border">
            {medExpired.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-3">
                <Avatar className="h-9 w-9 shrink-0">
                  {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                  <AvatarFallback className="text-[11px] rounded-none">
                    {c.full_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[c.occupation, c.passport_number].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
                    Expired
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.status}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2 flex justify-end">
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setMedOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tasheer Done + Wokala Unpaid Dialog */}
      <Dialog open={tasheerOpen} onOpenChange={setTasheerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
              <AlertTriangle className="h-5 w-5" />
              Tasheer Done — Wokala Unpaid ({tasheerDoneWokalaUnpaid.length})
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-0 divide-y divide-border">
            {tasheerDoneWokalaUnpaid.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-3">
                <Avatar className="h-9 w-9 shrink-0">
                  {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                  <AvatarFallback className="text-[11px] rounded-none">
                    {c.full_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[c.occupation, c.passport_number].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                    Wokala Unpaid
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.status}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2 flex justify-end">
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setTasheerOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* COC Not Done Dialog */}
      <Dialog open={cocNotDoneOpen} onOpenChange={setCocNotDoneOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
              <AlertTriangle className="h-5 w-5" />
              COC Not Done ({cocNotDone.length})
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-0 divide-y divide-border">
            {cocNotDone.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-3">
                <Avatar className="h-9 w-9 shrink-0">
                  {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                  <AvatarFallback className="text-[11px] rounded-none">
                    {c.full_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[c.occupation, c.passport_number].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300">
                    Not Done
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.status}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2 flex justify-end">
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setCocNotDoneOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Medical Not Fit Dialog */}
      <Dialog open={medNotFitOpen} onOpenChange={setMedNotFitOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <Stethoscope className="h-5 w-5" />
              Medical Not Fit ({medNotFit.length})
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-0 divide-y divide-border">
            {medNotFit.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-3">
                <Avatar className="h-9 w-9 shrink-0">
                  {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                  <AvatarFallback className="text-[11px] rounded-none">
                    {c.full_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[c.occupation, c.passport_number].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                    Not Fit
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.status}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2 flex justify-end">
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setMedNotFitOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* COC Done + Medical Not Fit Dialog */}
      <Dialog open={cocDoneMedNotFitOpen} onOpenChange={setCocDoneMedNotFitOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <AlertTriangle className="h-5 w-5" />
              COC Done — Medical Not Fit ({cocDoneMedNotFit.length})
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-0 divide-y divide-border">
            {cocDoneMedNotFit.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-3">
                <Avatar className="h-9 w-9 shrink-0">
                  {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                  <AvatarFallback className="text-[11px] rounded-none">
                    {c.full_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[c.occupation, c.passport_number].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                    Medical Not Fit
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.status}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2 flex justify-end">
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setCocDoneMedNotFitOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Visa Returned Dialog */}
      <Dialog open={visaReturnedOpen} onOpenChange={setVisaReturnedOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sky-700 dark:text-sky-300">
              <RotateCcw className="h-5 w-5" />
              Visa Returned ({visaReturned.length})
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-0 divide-y divide-border">
            {visaReturned.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-3">
                <Avatar className="h-9 w-9 shrink-0">
                  {c.photo_url && <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />}
                  <AvatarFallback className="text-[11px] rounded-none">
                    {c.full_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[c.occupation, c.passport_number].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                    Returned
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.status}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2 flex justify-end">
            <Button asChild size="sm" className="rounded-none text-xs gap-1">
              <Link to="/manager/candidates" onClick={() => setVisaReturnedOpen(false)}>
                Go to Candidates <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
