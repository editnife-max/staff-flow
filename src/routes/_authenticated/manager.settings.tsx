import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { Settings2, Eye, EyeOff, Save } from "lucide-react";
import { toast } from "sonner";
import { getColumnRestrictions, setColumnRestrictions } from "@/lib/manager-settings.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/manager/settings")({
  head: () => ({ meta: [{ title: "Settings — Staff-Flow" }] }),
  component: ManagerSettingsPage,
});

const COLUMNS = [
  { key: "medical_status",   label: "Medical Status",   desc: "Fit / Unfit / Booked…" },
  { key: "coc_status",       label: "COC",              desc: "Certificate of Competence status" },
  { key: "narrative",        label: "Narrative",        desc: "Relative contact narrative" },
  { key: "experience",       label: "Experience",       desc: "Yes / No experience field" },
  { key: "tasheer_status",   label: "Tasheer",          desc: "Processing — Tasheer column" },
  { key: "wokala_status",    label: "Wokala",           desc: "Processing — Wokala column" },
  { key: "visa_status",      label: "Visa Status",      desc: "Processing — Visa status column" },
  { key: "insurance_status", label: "Insurance",        desc: "Processing — Insurance column" },
  { key: "lmis_status",      label: "LMIS",             desc: "Processing — LMIS status column" },
  { key: "ticket_status",    label: "Ticket",           desc: "Processing — Ticket status column" },
  { key: "musaned_status",   label: "Country",          desc: "Musaned / destination country" },
  { key: "selected_by",      label: "Assigned To",      desc: "Agency assignment column" },
  { key: "cv_sent_to",       label: "CV Sent To",       desc: "CV distribution office column" },
];

function ManagerSettingsPage() {
  const qc = useQueryClient();
  const doGet = useServerFn(getColumnRestrictions);
  const doSet = useServerFn(setColumnRestrictions);

  const { data: saved = [], isLoading } = useQuery<string[]>({
    queryKey: ["manager-column-restrictions"],
    queryFn: () => doGet(),
    staleTime: 60_000,
  });

  const [restricted, setRestricted] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setRestricted(new Set(saved));
    setDirty(false);
  }, [saved]);

  const toggle = (key: string) => {
    setRestricted((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    setDirty(true);
  };

  const saveMut = useMutation({
    mutationFn: () => doSet({ data: { columns: Array.from(restricted) } }),
    onSuccess: () => {
      toast.success("Column restrictions saved");
      qc.invalidateQueries({ queryKey: ["manager-column-restrictions"] });
      setDirty(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restrictedCount = restricted.size;

  return (
    <div className="space-y-6 p-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings2 className="h-6 w-6" />
            Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage global access rules for your staff team</p>
        </div>
        {dirty && (
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="gap-2 shrink-0">
            <Save className="h-4 w-4" />
            {saveMut.isPending ? "Saving…" : "Save Changes"}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Column Restrictions</CardTitle>
              <CardDescription className="text-xs mt-1">
                Restricted columns are hidden from all staff. Use per-staff <span className="font-medium">Grant</span> overrides in Staff Activity to unblock individual users.
              </CardDescription>
            </div>
            {restrictedCount > 0 && (
              <Badge className="bg-red-500/10 text-red-700 border-0 shrink-0">
                {restrictedCount} restricted
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="divide-y divide-border">
              {COLUMNS.map((col) => {
                const isRestricted = restricted.has(col.key);
                return (
                  <div
                    key={col.key}
                    className={cn(
                      "flex items-center justify-between gap-4 px-4 py-3.5 transition-colors",
                      isRestricted && "bg-red-50/50 dark:bg-red-950/10",
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isRestricted
                        ? <EyeOff className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        : <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      }
                      <div className="min-w-0">
                        <p className={cn("text-sm font-medium", isRestricted && "text-red-700 dark:text-red-400")}>
                          {col.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-tight">{col.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {isRestricted && (
                        <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">Hidden from staff</span>
                      )}
                      <Switch
                        checked={isRestricted}
                        onCheckedChange={() => toggle(col.key)}
                        className={cn(isRestricted && "data-[state=checked]:bg-red-500")}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {dirty && (
        <div className="flex justify-end">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {saveMut.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
