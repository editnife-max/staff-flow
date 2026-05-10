import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Search, Download } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Route = createFileRoute("/_authenticated/staff/cv-generator")({
  head: () => ({ meta: [{ title: "CV Generator — Staff-Flow" }] }),
  validateSearch: z.object({ id: z.string().optional() }),
  component: CvGeneratorPage,
});

function CvGeneratorPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const [selectedId, setSelectedId] = useState<string | null>(search.id ?? null);
  const [query, setQuery] = useState("");
  const cvRef = useRef<HTMLDivElement>(null);

  const { data: candidates = [] } = useQuery({
    queryKey: ["cv-candidates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("candidates").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = candidates.filter((c) => !query || c.full_name.toLowerCase().includes(query.toLowerCase()));
  const selected = candidates.find((c) => c.id === selectedId) ?? candidates[0];

  const downloadPdf = async () => {
    if (!cvRef.current) return;
    const canvas = await html2canvas(cvRef.current, { scale: 2, backgroundColor: "#ffffff" });
    const pdf = new jsPDF({ unit: "px", format: [720, 900] });
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 720, 900);
    pdf.save(`${selected?.full_name ?? "candidate"}-cv.pdf`);
  };

  return (
    <div>
      <PageHeader
        title="CV Generator"
        description="Pick a candidate and download their CV as PDF."
        actions={selected && <Button onClick={downloadPdf}><Download className="h-4 w-4 mr-2" /> Download PDF</Button>}
      />
      <div className="flex gap-4 h-[calc(100vh-220px)]">
        {/* Left list */}
        <Card className="w-[420px] shrink-0 flex flex-col">
          <CardContent className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search candidates..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </CardContent>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left rounded-lg p-3 flex items-center gap-3 transition ${
                    selected?.id === c.id ? "bg-accent/10 ring-1 ring-accent" : "hover:bg-muted"
                  }`}
                >
                  <Avatar className="h-9 w-9"><AvatarFallback>{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.country ?? "—"} • {c.occupation ?? "—"}</div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-center text-sm text-muted-foreground p-6">No candidates.</div>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Right preview */}
        <div className="flex-1 overflow-auto">
          {selected ? (
            <div ref={cvRef} className="bg-white text-foreground mx-auto shadow-lg" style={{ width: 720, minHeight: 900 }}>
              <div className="bg-primary text-primary-foreground p-8">
                <h1 className="text-3xl font-semibold">{selected.full_name}</h1>
                <p className="text-primary-foreground/80 mt-1">{selected.occupation ?? "Professional"}</p>
              </div>
              <div className="p-8 space-y-6">
                <section>
                  <h2 className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Personal Details</h2>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-muted-foreground">Country</dt><dd>{selected.country ?? "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Date of birth</dt><dd>{selected.dob ?? "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Age</dt><dd>{selected.age ?? "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Gender</dt><dd>{selected.gender ?? "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Marital status</dt><dd>{selected.marital_status ?? "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Religion</dt><dd>{selected.religion ?? "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Passport #</dt><dd>{selected.passport_number ?? "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Education</dt><dd>{selected.education ?? "—"}</dd></div>
                  </dl>
                </section>
                <section>
                  <h2 className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Experience</h2>
                  <p className="text-sm whitespace-pre-line">{selected.experience ?? "No experience recorded."}</p>
                </section>
                <section>
                  <h2 className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Skills</h2>
                  <p className="text-sm whitespace-pre-line">{selected.skills ?? "No skills recorded."}</p>
                </section>
              </div>
            </div>
          ) : (
            <div className="h-full grid place-items-center text-muted-foreground">
              Select a candidate to preview their CV.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
