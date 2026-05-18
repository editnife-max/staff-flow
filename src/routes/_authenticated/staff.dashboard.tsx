import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  Users, Clock, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Stethoscope, FileCheck, ClipboardList, Ticket,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Candidate = Database["public"]["Tables"]["candidates"]["Row"];

export const Route = createFileRoute("/_authenticated/staff/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Staff-Flow" }] }),
  component: StaffDashboard,
});

const STATUS_CONFIG = [
  {
    key: "available" as const,
    label: "Available",
    icon: Users,
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    icon_bg: "bg-emerald-100 dark:bg-emerald-900/60",
    icon_color: "text-emerald-600 dark:text-emerald-400",
    value_color: "text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  {
    key: "processing" as const,
    label: "Processing",
    icon: Clock,
    bg: "bg-amber-50 dark:bg-amber-950/40",
    icon_bg: "bg-amber-100 dark:bg-amber-900/60",
    icon_color: "text-amber-600 dark:text-amber-400",
    value_color: "text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  {
    key: "arrived" as const,
    label: "Arrived",
    icon: CheckCircle2,
    bg: "bg-blue-50 dark:bg-blue-950/40",
    icon_bg: "bg-blue-100 dark:bg-blue-900/60",
    icon_color: "text-blue-600 dark:text-blue-400",
    value_color: "text-blue-700 dark:text-blue-300",
    bar: "bg-blue-500",
  },
  {
    key: "canceled" as const,
    label: "Canceled",
    icon: XCircle,
    bg: "bg-red-50 dark:bg-red-950/40",
    icon_bg: "bg-red-100 dark:bg-red-900/60",
    icon_color: "text-red-600 dark:text-red-400",
    value_color: "text-red-700 dark:text-red-300",
    bar: "bg-red-500",
  },
];

const STATUS_PILL: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  processing: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  arrived: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  canceled: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

const ALERT_PILL: Record<string, string> = {
  coc:    "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  medical:"bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  lmis:   "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  ticket: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
};

function AlertSection({
  icon: Icon,
  title,
  iconColor,
  pillKey,
  candidates,
  valueField,
  note,
}: {
  icon: React.ElementType;
  title: string;
  iconColor: string;
  pillKey: keyof typeof ALERT_PILL;
  candidates: Candidate[];
  valueField: keyof Candidate;
  note?: (c: Candidate) => string | null;
}) {
  const [open, setOpen] = useState(false);
  if (candidates.length === 0) return null;

  return (
    <div className="rounded-none border border-border overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-background hover:bg-muted/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
          <span className="text-sm font-semibold">{title}</span>
          <span className={cn("text-xs font-bold px-2 py-0.5 rounded-none", ALERT_PILL[pillKey])}>
            {candidates.length}
          </span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="divide-y divide-border border-t border-border">
          {candidates.map((c) => {
            const noteText = note?.(c) ?? null;
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 bg-muted/20">
                <Avatar className="h-8 w-8 shrink-0">
                  {c.photo_url && (
                    <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />
                  )}
                  <AvatarFallback className="text-[10px] rounded-none">
                    {c.full_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[c.occupation, c.country].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {noteText && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-none bg-muted text-muted-foreground">
                      {noteText}
                    </span>
                  )}
                  <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-none", ALERT_PILL[pillKey])}>
                    {String(c[valueField] ?? "—")}
                  </span>
                  <span className={cn(
                    "text-[11px] font-medium px-2 py-0.5 rounded-none capitalize",
                    STATUS_PILL[c.status] ?? "bg-muted text-muted-foreground",
                  )}>
                    {c.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StaffDashboard() {
  const { user } = useAuth();

  const { data: candidates = [] } = useQuery({
    queryKey: ["staff-dashboard-candidates", user?.id],
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

  const total = candidates.length;
  const counts = {
    available: candidates.filter((c) => c.status === "available").length,
    processing: candidates.filter((c) => c.status === "processing").length,
    arrived: candidates.filter((c) => c.status === "arrived").length,
    canceled: candidates.filter((c) => c.status === "canceled").length,
  };

  const cocNotDone   = candidates.filter((c) => c.coc_status && c.coc_status !== "Done");
  const medicalNotFit = candidates.filter((c) => c.medical_status && c.medical_status !== "Fit");
  const unfilledLmis  = candidates.filter((c) => c.unfilled_lmis && c.unfilled_lmis.trim() !== "");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ticketNotBooked = candidates.filter((c) => {
    if (!c.contract_date) return false;
    if (c.ticket_status === "Booked") return false;
    const contractDay = new Date(c.contract_date + "T00:00:00");
    const days = Math.floor((today.getTime() - contractDay.getTime()) / 86_400_000);
    return days > 20;
  });

  const daysSince = (contractDate: string) => {
    const d = new Date(contractDate + "T00:00:00");
    return Math.floor((today.getTime() - d.getTime()) / 86_400_000);
  };

  return (
    <div className="space-y-6 mx-[79.6px]">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <Button asChild size="sm" className="gap-2 text-xs h-8 rounded-none">
          <Link to="/staff/candidates">
            <Users className="h-4 w-4" /> HR Pool
          </Link>
        </Button>
      </div>

      {/* Status stat cards */}
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
                  <div
                    className={cn("h-full rounded-none transition-all", s.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{pct}% of total</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Alert rows */}
      {(cocNotDone.length > 0 || medicalNotFit.length > 0 || unfilledLmis.length > 0 || ticketNotBooked.length > 0) && (
        <div className="space-y-2">
          <AlertSection
            icon={FileCheck}
            title="COC — Not Done"
            iconColor="text-orange-600 dark:text-orange-400"
            pillKey="coc"
            candidates={cocNotDone}
            valueField="coc_status"
          />
          <AlertSection
            icon={Stethoscope}
            title="Medical — Not Fit"
            iconColor="text-red-600 dark:text-red-400"
            pillKey="medical"
            candidates={medicalNotFit}
            valueField="medical_status"
          />
          <AlertSection
            icon={ClipboardList}
            title="Unfilled LMIS"
            iconColor="text-amber-600 dark:text-amber-400"
            pillKey="lmis"
            candidates={unfilledLmis}
            valueField="unfilled_lmis"
          />
          <AlertSection
            icon={Ticket}
            title="Ticket Not Booked — Over 20 Days"
            iconColor="text-violet-600 dark:text-violet-400"
            pillKey="ticket"
            candidates={ticketNotBooked}
            valueField="ticket_status"
            note={(c) => c.contract_date ? `${daysSince(c.contract_date)}d since contract` : null}
          />
        </div>
      )}
    </div>
  );
}
