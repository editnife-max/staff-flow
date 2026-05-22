import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Search, Download, FileText, CheckCircle2, User } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import PizZip from "pizzip";
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
type Candidate = Database["public"]["Tables"]["candidates"]["Row"];

// ── DOCX fill ────────────────────────────────────────────────────────────────

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function reEscape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceValueCell(rowXml: string, newValue: string): string {
  const cut = rowXml.indexOf("</w:tc>");
  if (cut === -1) return rowXml;
  const before = rowXml.slice(0, cut + 7);
  const after = rowXml.slice(cut + 7);
  // Replace content of the first <w:t …>…</w:t> in the value cell
  const filled = after.replace(
    /(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/,
    (_, open, _old, close) => `${open}${xmlEscape(newValue)}${close}`,
  );
  return before + filled;
}

async function buildFilledDocx(templateUrl: string, c: Candidate): Promise<Blob> {
  const res = await fetch(templateUrl, { mode: "cors" });
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength === 0) throw new Error("Template file is empty");

  const zip = new PizZip(buffer);
  const docEntry = zip.file("word/document.xml");
  if (!docEntry) throw new Error("word/document.xml not found in template");
  let xml = docEntry.asText();

  const fields: Array<[string, string | null | undefined]> = [
    ["FULL NAME",      c.full_name],
    ["POSITION",       c.occupation],
    ["NUMBER",         c.passport_number],
    ["DATE OF ISSUE",  c.passport_issue_date],
    ["DATE OF EXPIRY", c.passport_expiry_date],
    ["PLACE OF ISSUE", c.place_of_issue ?? c.country],
    ["ENGLISH",        c.english_level],
    ["ARABIC",         c.arabic_level],
    ["EXPERIENCE",     c.experience],
    ["NATIONALITY",    c.country],
    ["RELIGION",       c.religion],
    ["DATE OF BIRTH",  c.dob],
    ["PLACE OF BIRTH", c.birth_place],
    ["LIVING TOWN",    c.living_town],
    ["AGE",            c.age != null ? String(c.age) : null],
    ["MARITAL STATUS", c.marital_status],
    ["CHILDREN",       c.children != null ? String(c.children) : null],
    ["WEIGHT",         c.weight != null ? `${c.weight} kg` : null],
    ["HEIGHT",         c.height != null ? `${c.height} cm` : null],
    ["REMARK",         c.notes ?? c.remark],
  ];

  const parts = xml.split("</w:tr>");
  xml = parts.map((row) => {
    for (const [label, value] of fields) {
      if (value == null || value === "") continue;
      if (new RegExp(`<w:t[^>]*>${reEscape(label)}<\\/w:t>`).test(row)) {
        return replaceValueCell(row, String(value));
      }
    }
    return row;
  }).join("</w:tr>");

  zip.file("word/document.xml", xml);
  const uint8 = zip.generate({ type: "uint8array" });
  return new Blob([uint8.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

// ── CV helpers ────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <div>
      <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: "#1e293b", lineHeight: 1.4 }}>{String(value)}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: "#5cb8c4",
      textTransform: "uppercase" as const, letterSpacing: 1,
      borderBottom: "1.5px solid #e2e8f0", paddingBottom: 4, marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function CvPreview({ candidate: c, template }: { candidate: Candidate; template: CvTemplate | null }) {
  const photo = c.full_photo_url ?? c.photo_url;
  return (
    <div style={{ width: 720, backgroundColor: "#ffffff", fontFamily: "'Segoe UI', Arial, sans-serif", color: "#1e293b", boxSizing: "border-box" as const }}>
      {/* Header */}
      <div style={{ backgroundColor: "#1a3a52", color: "#ffffff", padding: "28px 32px", display: "flex", alignItems: "flex-start", gap: 20 }}>
        {photo ? (
          <img src={photo} alt="" crossOrigin="anonymous" style={{ width: 90, height: 110, objectFit: "cover", borderRadius: 4, flexShrink: 0, border: "2px solid rgba(255,255,255,0.2)" }} />
        ) : (
          <div style={{ width: 90, height: 110, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>
            {c.full_name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{c.full_name}</div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, marginBottom: 8 }}>{c.occupation ?? "Professional"}</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" as const }}>
            {c.country && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>🌍 {c.country}</span>}
            {c.candidate_code && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>ID: {c.candidate_code}</span>}
            {template && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Template: {template.name}</span>}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", minHeight: 700 }}>
        {/* Sidebar */}
        <div style={{ width: 210, backgroundColor: "#f8fafc", borderRight: "1px solid #e2e8f0", padding: "24px 18px", flexShrink: 0 }}>
          <div style={{ marginBottom: 22 }}>
            <SectionTitle>Personal</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
              <Row label="Date of Birth" value={c.dob} />
              <Row label="Age" value={c.age != null ? `${c.age} years` : null} />
              <Row label="Gender" value={c.gender} />
              <Row label="Marital Status" value={c.marital_status} />
              <Row label="Religion" value={c.religion} />
              <Row label="Children" value={c.children != null ? String(c.children) : null} />
              <Row label="Birth Place" value={c.birth_place} />
              <Row label="Living Town" value={c.living_town} />
            </div>
          </div>
          {(c.height != null || c.weight != null) && (
            <div style={{ marginBottom: 22 }}>
              <SectionTitle>Physical</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                <Row label="Height" value={c.height != null ? `${c.height} cm` : null} />
                <Row label="Weight" value={c.weight != null ? `${c.weight} kg` : null} />
              </div>
            </div>
          )}
          {(c.arabic_level || c.english_level || c.spoken_languages) && (
            <div style={{ marginBottom: 22 }}>
              <SectionTitle>Languages</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                <Row label="Arabic" value={c.arabic_level} />
                <Row label="English" value={c.english_level} />
                <Row label="Other" value={c.spoken_languages} />
              </div>
            </div>
          )}
          {c.emergency_contact && (
            <div style={{ marginBottom: 22 }}>
              <SectionTitle>Emergency Contact</SectionTitle>
              <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.5, wordBreak: "break-word" as const }}>{c.emergency_contact}</div>
            </div>
          )}
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: "24px 28px" }}>
          <div style={{ marginBottom: 22 }}>
            <SectionTitle>Documents & Background</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
              <Row label="Education" value={c.education} />
              <Row label="Passport No." value={c.passport_number} />
              <Row label="Passport Expiry" value={c.passport_expiry_date} />
              <Row label="Passport Issue Date" value={c.passport_issue_date} />
              <Row label="Place of Issue" value={c.place_of_issue} />
              <Row label="Nationality" value={c.country} />
            </div>
          </div>
          <div style={{ marginBottom: 22 }}>
            <SectionTitle>Work Experience</SectionTitle>
            <div style={{ fontSize: 12, color: "#334155", whiteSpace: "pre-line", lineHeight: 1.8 }}>{c.experience || "No experience recorded."}</div>
          </div>
          {c.skills && (
            <div style={{ marginBottom: 22 }}>
              <SectionTitle>Skills</SectionTitle>
              <div style={{ fontSize: 12, color: "#334155", whiteSpace: "pre-line", lineHeight: 1.8 }}>{c.skills}</div>
            </div>
          )}
          {c.narrative && (
            <div style={{ marginBottom: 22 }}>
              <SectionTitle>Additional Information</SectionTitle>
              <div style={{ fontSize: 12, color: "#334155", whiteSpace: "pre-line", lineHeight: 1.8 }}>{c.narrative}</div>
              {c.narrative_phone && <div style={{ marginTop: 6, fontSize: 11, color: "#64748b" }}>Contact: {c.narrative_phone}</div>}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ backgroundColor: "#1a3a52", padding: "10px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{c.serial_number ? `Serial: ${c.serial_number}` : ""}</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Generated by FlowPath</span>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function CvGeneratorPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const [selectedId, setSelectedId] = useState<string | null>(search.id ?? null);
  const [selectedTemplate, setSelectedTemplate] = useState<CvTemplate | null>(null);
  const [query, setQuery] = useState("");
  const cvRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

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
        .from("cv_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as CvTemplate[];
    },
  });

  const filtered = candidates.filter((c) => !query || c.full_name.toLowerCase().includes(query.toLowerCase()));
  const selected = candidates.find((c) => c.id === selectedId) ?? candidates[0];

  function triggerBlobDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function downloadRawFile(url: string, filename: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = new Blob([await res.arrayBuffer()], { type: "application/octet-stream" });
    const ext = url.split("?")[0].split(".").pop() ?? "pdf";
    triggerBlobDownload(blob, `${filename}.${ext}`);
  }

  const handleDownload = async () => {
    if (!selected) return;
    setDownloading(true);
    try {
      if (selectedTemplate) {
        const isDocx = selectedTemplate.file_url.split("?")[0].toLowerCase().endsWith(".docx");
        const baseName = `${selected.full_name} — ${selectedTemplate.name}`;
        if (isDocx) {
          const blob = await buildFilledDocx(selectedTemplate.file_url, selected);
          triggerBlobDownload(blob, `${baseName}.docx`);
          toast.success("Filled DOCX downloaded");
        } else {
          await downloadRawFile(selectedTemplate.file_url, baseName);
        }
        return;
      }
      // No template — generate from HTML preview
      if (!cvRef.current) return;
      const canvas = await html2canvas(cvRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true, allowTaint: false });
      const pxW = canvas.width / 2;
      const pxH = canvas.height / 2;
      const pdf = new jsPDF({ unit: "px", format: [pxW, pxH] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pxW, pxH);
      pdf.save(`${selected.full_name}-cv.pdf`);
      toast.success("CV downloaded");
    } catch (e: any) {
      toast.error(e.message ?? "Download failed");
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
              {downloading ? "Downloading…" : selectedTemplate ? `Download — ${selectedTemplate.name}` : "Generate CV"}
            </Button>
          )
        }
      />
      <div className="flex gap-4 h-[calc(100vh-220px)]">

        {/* Candidates */}
        <Card className="w-[260px] shrink-0 flex flex-col rounded-none">
          <CardContent className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 rounded-none" placeholder="Search candidates…" value={query} onChange={(e) => setQuery(e.target.value)} />
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
                    selected?.id === c.id ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted",
                  )}
                >
                  {c.photo_url ? (
                    <img src={c.photo_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback>{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.country ?? "—"} · {c.occupation ?? "—"}</div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && <div className="text-center text-sm text-muted-foreground p-6">No candidates.</div>}
            </div>
          </ScrollArea>
        </Card>

        {/* Templates */}
        <Card className="w-[220px] shrink-0 flex flex-col rounded-none">
          <CardContent className="p-3 border-b">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" />
              CV Templates
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Select a template or leave unselected to auto-generate</p>
          </CardContent>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {templates.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8 px-2">No templates yet. Ask your manager to upload one.</p>
              ) : (
                templates.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "rounded-none border p-2.5 cursor-pointer transition-colors",
                      selectedTemplate?.id === t.id ? "border-primary/40 bg-primary/5" : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40",
                    )}
                    onClick={() => setSelectedTemplate(selectedTemplate?.id === t.id ? null : t)}
                  >
                    <div className="flex items-start gap-2">
                      <FileText className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", selectedTemplate?.id === t.id ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-xs font-medium flex-1 leading-tight">{t.name}</span>
                      {selectedTemplate?.id === t.id && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
                        {t.file_url.split("?")[0].endsWith(".docx") ? "DOCX — auto-fill" : "PDF"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          {selectedTemplate && (
            <div className="p-3 border-t bg-primary/5">
              <p className="text-[10px] text-primary font-medium truncate">✓ {selectedTemplate.name}</p>
              {selectedTemplate.file_url.split("?")[0].toLowerCase().endsWith(".docx") && (
                <p className="text-[9px] text-muted-foreground mt-0.5">Candidate data will be filled automatically</p>
              )}
            </div>
          )}
        </Card>

        {/* CV Preview */}
        <div className="flex-1 overflow-auto bg-muted/30 p-4">
          {selected ? (
            <div ref={cvRef} className="mx-auto shadow-xl">
              <CvPreview candidate={selected} template={selectedTemplate} />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <User className="h-12 w-12 opacity-20" />
              <p className="text-sm">Select a candidate to preview their CV.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
