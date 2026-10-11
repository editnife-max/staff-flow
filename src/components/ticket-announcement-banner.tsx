import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plane, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getTicketAnnouncements, dismissTicketAnnouncement } from "@/lib/candidates.functions";
import { Button } from "@/components/ui/button";

export function TicketAnnouncementBanner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const getAnnouncementsFn    = useServerFn(getTicketAnnouncements);
  const dismissAnnouncementFn = useServerFn(dismissTicketAnnouncement);
  const [index, setIndex] = useState(0);

  const { data: announcements = [] } = useQuery({
    queryKey: ["ticket-announcements", user?.id],
    queryFn: () => getAnnouncementsFn(),
    enabled: !!user,
    refetchInterval: 30_000,
    staleTime: 0,
  });

  const dismissMut = useMutation({
    mutationFn: (id: string) => dismissAnnouncementFn({ data: { id } }),
    onSuccess: () => {
      setIndex((i) => Math.max(0, i - 1));
      qc.invalidateQueries({ queryKey: ["ticket-announcements", user?.id] });
    },
  });

  if (announcements.length === 0) return null;

  const current = announcements[Math.min(index, announcements.length - 1)];
  const total   = announcements.length;

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative bg-background border border-border shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-sm bg-primary/10 grid place-items-center">
              <Plane className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-widest leading-none">
                Ticket Booked
              </p>
              {total > 1 && (
                <p className="text-xs text-muted-foreground mt-0.5">{index + 1} of {total}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismissMut.mutate(current.id)}
            disabled={dismissMut.isPending}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            title="Dismiss for everyone"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-8 text-center space-y-4">
          <p className="text-2xl font-bold tracking-tight">{current.candidate_name}</p>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">Ticket Date</p>
            <p className="text-base text-muted-foreground">
              {current.ticket_date
                ? new Date(current.ticket_date + "T00:00:00").toLocaleDateString("en-GB", {
                    weekday: "long", day: "2-digit", month: "long", year: "numeric",
                  })
                : "Not set"}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center gap-3">
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className="p-1.5 border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
                disabled={index >= total - 1}
                className="p-1.5 border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
          <Button
            className="flex-1 h-9 rounded-none text-sm"
            onClick={() => dismissMut.mutate(current.id)}
            disabled={dismissMut.isPending}
          >
            {dismissMut.isPending ? "Dismissing…" : "Got it"}
          </Button>
        </div>
      </div>
    </div>
  );
}
