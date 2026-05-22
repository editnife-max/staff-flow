import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Search, Download, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
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
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/staff/cv-generator")({
  head: () => ({ meta: [{ title: "CV Generator — Staff-Flow" }] }),
  validateSearch: z.object({ id: z.string().optional() }),
  component: CvGeneratorPage,
});

type CvTemplate = Database["public"]["Tables"]["cv_templates"]["Row"];

function CvGeneratorPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const [selectedId, setSelectedId] = useState<string | null>(search.id ?? null);
  const [selectedTemplate, setSelectedTemplate] = useState<CvTemplate | null>(null);
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

  const { data: templates = [] } = useQuery({
    queryKey: ["cv-templates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cv_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CvTemplate[];
    },
  });

  const filtered = candidates.filter((c) => !query || c.full_name.toLowerCase().includes(query.toLowerCase()));
  const selected = candidates.find((c) => c.id === selectedId) ?? candidates[0];

  const [downloading, setDownloading] = useState(false);

  async function downloadFilePdf(url: string, filename: string) {
    setDownloading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = await res.arrayBuffer();
      const blob = new Blob([buffer], { type: "application/octet-stream" });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      const ext = url.split("?")[0].split(".").pop() ?? "pdf";
      a.download = `${filename}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      toast.error(`Download failed: ${e.message}`);
    } finally {
      setDownloading(false);
    }
  }

  const handleDownload = async () => {
    if (selectedTemplate) {
      const filename = selected
        ? `${selected.full_name} — ${selectedTemplate.name}`
        : selectedTemplate.name;
      await downloadFilePdf(selectedTemplate.file_url, filename);
      return;
    }
    if (!cvRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(cvRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const pdf = new jsPDF({ unit: "px", format: [720, 900] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 720, 900);
      pdf.save(`${selected?.full_name ?? "candidate"}-cv.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="CV Generator"
        description="Pick a candidate, select a template, then download the CV."
        actions={
          selected && (
            <Button onClick={handleDownload} disabled={downloading}>
              <Download className="h-4 w-4 mr-2" />
              {downloading
                ? "Downloading…"
                : selectedTemplate
                ? `Download — ${selectedTemplate.name}`
                : "Generate CV"}
            </Button>
          )
        }
      />
      <div className="flex gap-4 h-[calc(100vh-220px)]">
        {/* ── Candidates ──────────────────────────────────────────────────── */}
        <Card className="w-[260px] shrink-0 flex flex-col rounded-none">
          <CardContent className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 rounded-none"
                placeholder="Search candidates…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </CardContent>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "w-full text-left rounded-none p-3 flex items-center gap-3 transition border",
                    selected?.id === c.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-transparent hover:bg-muted",
                  )}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback>{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.country ?? "—"} · {c.occupation ?? "—"}
                    </div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-center text-sm text-muted-foreground p-6">No candidates.</div>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* ── CV Templates ─────────────────────────────────────────────────── */}
        <Card className="w-[220px] shrink-0 flex flex-col rounded-none">
          <CardContent className="p-3 border-b">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" />
              CV Templates
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Select a template to use</p>
          </CardContent>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {templates.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8 px-2">
                  No templates yet. Ask your manager to upload one.
                </p>
              ) : (
                templates.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "rounded-none border p-2.5 cursor-pointer transition-colors group",
                      selectedTemplate?.id === t.id
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40",
                    )}
                    onClick={() => setSelectedTemplate(selectedTemplate?.id === t.id ? null : t)}
                  >
                    <div className="flex items-start gap-2">
                      <FileText className={cn(
                        "h-3.5 w-3.5 mt-0.5 shrink-0",
                        selectedTemplate?.id === t.id ? "text-primary" : "text-muted-foreground",
                      )} />
                      <span className="text-xs font-medium flex-1 leading-tight">{t.name}</span>
                      {selectedTemplate?.id === t.id && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                    </div>
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); downloadFilePdf(t.file_url, t.name); }}
                        className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                      >
                        <Download className="h-3 w-3" /> Download
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          {selectedTemplate && (
            <div className="p-3 border-t bg-primary/5">
              <p className="text-[10px] text-primary font-medium truncate">
                ✓ {selectedTemplate.name}
              </p>
              <button
                type="button"
                onClick={() => downloadFilePdf(selectedTemplate.file_url, selectedTemplate.name)}
                className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
              >
                <Download className="h-3 w-3" /> Download template
              </button>
            </div>
          )}
        </Card>

        {/* ── CV Preview ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto">
          {selected ? (
            <div
              ref={cvRef}
              className="bg-white text-foreground mx-auto shadow-lg"
              style={{ width: 720, minHeight: 900 }}
            >
              <div className="bg-primary text-primary-foreground p-8">
                <h1 className="text-3xl font-semibold">{selected.full_name}</h1>
                <p className="text-primary-foreground/80 mt-1">
                  {selected.occupation ?? "Professional"}
                </p>
                {selectedTemplate && (
                  <p className="text-primary-foreground/60 text-xs mt-2">
                    Template: {selectedTemplate.name}
                  </p>
                )}
              </div>
              <div className="p-8 space-y-6">
                <section>
                  <h2 className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">
                    Personal Details
                  </h2>
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
                  <h2 className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">
                    Experience
                  </h2>
                  <p className="text-sm whitespace-pre-line">
                    {selected.experience ?? "No experience recorded."}
                  </p>
                </section>
                <section>
                  <h2 className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">
                    Skills
                  </h2>
                  <p className="text-sm whitespace-pre-line">
                    {selected.skills ?? "No skills recorded."}
                  </p>
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
