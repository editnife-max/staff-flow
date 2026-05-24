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
    </div>
  );
}
