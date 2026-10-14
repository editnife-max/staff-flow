import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, Video, VideoOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff/tc")({
  head: () => ({ meta: [{ title: "TC — Staff-Flow" }] }),
  validateSearch: z.object({
    tab: z.enum(["entered", "trained"]).optional(),
  }),
  component: TcPage,
});

type TcCandidate = {
  id: string;
  full_name: string;
  candidate_code: string | null;
  serial_number: string | null;
  video_url: string | null;
  updated_at: string;
};

const TABS = [
  { key: "entered" as const, label: "Entered Girls" },
  { key: "trained" as const, label: "Trained Girls" },
];

function TcPage() {
  const { user } = useAuth();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const activeTab = tab ?? "entered";
  const [search, setSearch] = useState("");

  const { data: candidates = [], isLoading } = useQuery<TcCandidate[]>({
    queryKey: ["tc-candidates", activeTab],
    queryFn: async () => {
      let q = supabase
        .from("candidates")
        .select("id,full_name,candidate_code,serial_number,video_url,updated_at")
        .eq("status", "available")
        .order("full_name", { ascending: true });

      if (activeTab === "trained") {
        q = q.not("video_url", "is", null);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as TcCandidate[];
    },
    enabled: !!user,
  });

  const filtered = candidates.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) ||
      (c.candidate_code ?? "").toLowerCase().includes(q) ||
      (c.serial_number ?? "").toLowerCase().includes(q)
    );
  });

  function formatVideoDate(c: TcCandidate) {
    if (!c.video_url) return null;
    return new Date(c.updated_at).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-semibold">Training Centre</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, ID…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => navigate({ search: { tab: t.key } })}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground py-12 text-center">No candidates found.</div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Full Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Relative ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Video Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((c, i) => {
                const videoDate = formatVideoDate(c);
                return (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{c.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono">
                      {c.candidate_code ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono">
                      {c.serial_number ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {videoDate ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <Video className="h-3.5 w-3.5" />
                          {videoDate}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <VideoOff className="h-3.5 w-3.5" />
                          Not uploaded
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {filtered.length} candidate{filtered.length !== 1 ? "s" : ""}
        {activeTab === "trained" ? " with video uploaded" : " available"}
      </p>
    </div>
  );
}
