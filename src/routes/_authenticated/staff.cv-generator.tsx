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
type Candidate  = Database["public"]["Tables"]["candidates"]["Row"];

// ── DOCX fill (base64 data-URL — avoids Blob/revokeObjectURL timing issues) ──

function xmlEsc(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
          .replace(/"/g,"&quot;");
}

// Find the label cell, navigate to the adjacent value cell, replace the <w:t> text.
// Specifically matches <w:t> / <w:t ...> tags — NOT <w:tc> / <w:tcPr> (the critical fix).
function fillField(xml: string, label: string, value: string): string {
  const marker = ">" + label + "</w:t>";
  const pos = xml.indexOf(marker);
  if (pos === -1) return xml;

  const cellClose = xml.indexOf("</w:tc>", pos + marker.length);
  if (cellClose === -1) return xml;

  const valueCellStart = xml.indexOf("<w:tc", cellClose + 7);
  if (valueCellStart === -1) return xml;

  const valueCellEnd = xml.indexOf("</w:tc>", valueCellStart);
  if (valueCellEnd === -1) return xml;

  let searchFrom = valueCellStart;
  let tOpenStart = -1, tOpenEnd = -1;
  while (searchFrom < valueCellEnd) {
    const idx = xml.indexOf("<w:t", searchFrom);
    if (idx === -1 || idx >= valueCellEnd) break;
    const ch = xml[idx + 4];
    if (ch === ">" || ch === " " || ch === "\n" || ch === "\t") {
      tOpenStart = idx;
      tOpenEnd   = xml.indexOf(">", tOpenStart);
      break;
    }
    searchFrom = idx + 1;
  }
  if (tOpenStart === -1 || tOpenEnd === -1 || tOpenEnd >= valueCellEnd) return xml;

  const tClose = xml.indexOf("</w:t>", tOpenEnd + 1);
  if (tClose === -1 || tClose >= valueCellEnd) return xml;

  return xml.slice(0, tOpenEnd + 1) + xmlEsc(value) + xml.slice(tClose);
}

async function buildFilledDocxBase64(url: string, c: Candidate): Promise<string> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 100) throw new Error("Template file is empty");

  const zip   = new PizZip(buf);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("word/document.xml missing");

  // Decode as UTF-8 to handle Arabic content correctly
  let xml = new TextDecoder("utf-8").decode(entry.asUint8Array());

  const fields: [string, string | null | undefined][] = [
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
    ["AGE",            c.age  != null ? String(c.age)  : null],
    ["MARITAL STATUS", c.marital_status],
    ["CHILDREN",       c.children != null ? String(c.children) : null],
    ["WEIGHT",         c.weight != null ? `${c.weight} kg` : null],
    ["HEIGHT",         c.height != null ? `${c.height} cm` : null],
    ["REMARK",         c.notes ?? c.remark],
  ];

  for (const [label, value] of fields) {
    if (!value) continue;
    xml = fillField(xml, label, String(value));
  }

  // Write back as UTF-8 bytes
  zip.file("word/document.xml", new TextEncoder().encode(xml));
  return zip.generate({ type: "base64" });
}

// ── CV preview — matches DOCX template layout ─────────────────────────────────

const NAVY  = "#1A3A6B";
const BLUE  = "#2B5BA8";
const LBLUE = "#AACCEE";
const WHITE = "#FFFFFF";
const GRAY  = "#F2F4F8";
const DARK  = "#222222";
const BORDER = "1px solid #CCCCCC";

type CSSProps = React.CSSProperties;

function td(extra: CSSProps = {}): CSSProps {
  return { padding: "5px 9px", border: BORDER, fontSize: 11,
           fontFamily: "Arial, sans-serif", verticalAlign: "middle", ...extra };
}

function SectionHdr({ en, ar }: { en: string; ar: string }) {
  return (
    <tr>
      <td colSpan={2} style={td({ backgroundColor: BLUE, color: WHITE, fontWeight: "bold", border: "none" })}>{en}</td>
      <td colSpan={2} style={td({ backgroundColor: BLUE, color: LBLUE, textAlign: "right", border: "none", direction: "rtl" })}>{ar}</td>
    </tr>
  );
}

function DataRow({ lbl, val, ar, bg1=GRAY, bg2=WHITE, span=false }:
  { lbl: string; val?: string|number|null; ar: string; bg1?: string; bg2?: string; span?: boolean }) {
  return (
    <tr>
      <td style={td({ backgroundColor: bg1, color: DARK, fontWeight: "bold" })}>{lbl}</td>
      {span
        ? <td colSpan={3} style={td({ backgroundColor: bg2, color: DARK })}>{val ?? ""}</td>
        : <>
            <td style={td({ backgroundColor: bg2, color: DARK })}>{val ?? ""}</td>
            <td style={td({ backgroundColor: bg1, color: DARK, fontWeight: "bold", textAlign: "right", direction: "rtl" })}>{ar}</td>
            <td style={td({ backgroundColor: bg2, color: DARK })}></td>
          </>
      }
    </tr>
  );
}

function CvPreview({ candidate: c, template }: { candidate: Candidate; template: CvTemplate | null }) {
  const photo = c.full_photo_url ?? c.photo_url;
  return (
    <div style={{ width: 720, fontFamily: "Arial, sans-serif", backgroundColor: WHITE }}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "27%" }} /><col style={{ width: "28%" }} />
          <col style={{ width: "21%" }} /><col style={{ width: "24%" }} />
        </colgroup>
        <tbody>
          {/* Header */}
          <tr>
            <td colSpan={2} style={{ backgroundColor: NAVY, padding: "14px 16px", border: "none" }}>
              {template && <div style={{ color: LBLUE, fontSize: 9, marginBottom: 2 }}>{template.name}</div>}
              <div style={{ color: WHITE, fontSize: 15, fontWeight: "bold" }}>APPLICATION FOR EMPLOYMENT</div>
            </td>
            <td colSpan={2} style={{ backgroundColor: NAVY, padding: "14px 16px", border: "none",
                                     textAlign: "right", verticalAlign: "middle", direction: "rtl" }}>
              {photo && <img src={photo} alt="" crossOrigin="anonymous"
                style={{ width: 60, height: 72, objectFit: "cover", float: "left", marginRight: 8, border: "1px solid rgba(255,255,255,0.3)" }} />}
              <span style={{ color: LBLUE, fontSize: 14 }}>طلب توظيف</span>
            </td>
          </tr>

          {/* Full name */}
          <tr>
            <td style={td({ backgroundColor: NAVY, color: WHITE, fontWeight: "bold", border: "none" })}>FULL NAME</td>
            <td style={td({ backgroundColor: NAVY, color: WHITE, fontWeight: "bold", fontSize: 13, border: "none" })}>{c.full_name}</td>
            <td style={td({ backgroundColor: NAVY, color: LBLUE, fontWeight: "bold", textAlign: "right", border: "none", direction: "rtl" })}>الاسم الكامل</td>
            <td style={td({ backgroundColor: NAVY, border: "none" })}></td>
          </tr>

          {/* Contract / Position */}
          <tr>
            <td style={td({ backgroundColor: BLUE, color: WHITE, fontWeight: "bold", border: "none" })}>CONTRACT PERIOD</td>
            <td style={td({ backgroundColor: BLUE, color: WHITE, border: "none" })}>2 years</td>
            <td style={td({ backgroundColor: BLUE, color: LBLUE, textAlign: "right", border: "none", direction: "rtl" })}>مدة العقد</td>
            <td style={td({ backgroundColor: BLUE, border: "none" })}></td>
          </tr>
          <tr>
            <td style={td({ backgroundColor: BLUE, color: WHITE, fontWeight: "bold", border: "none" })}>POSITION</td>
            <td style={td({ backgroundColor: BLUE, color: WHITE, border: "none" })}>{c.occupation || "House Maid"}</td>
            <td style={td({ backgroundColor: BLUE, color: LBLUE, textAlign: "right", border: "none", direction: "rtl" })}>الوظيفة</td>
            <td style={td({ backgroundColor: BLUE, border: "none" })}></td>
          </tr>

          {/* Passport */}
          <SectionHdr en="PASSPORT DETAIL  |" ar="بيانات جواز السفر" />
          <DataRow lbl="NUMBER"         val={c.passport_number}       ar="رقم الجواز"      bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="DATE OF ISSUE"  val={c.passport_issue_date}   ar="تاريخ الإصدار"   bg1={WHITE} bg2={GRAY}  />
          <DataRow lbl="DATE OF EXPIRY" val={c.passport_expiry_date}  ar="تاريخ الانتهاء"  bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="PLACE OF ISSUE" val={c.place_of_issue ?? c.country} ar="مكان الإصدار" bg1={WHITE} bg2={GRAY} />

          {/* Language */}
          <SectionHdr en="LANGUAGE AND EDUCATION  |" ar="اللغة والتعليم" />
          <DataRow lbl="ENGLISH" val={c.english_level} ar="اللغة الإنجليزية" bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="ARABIC"  val={c.arabic_level}  ar="اللغة العربية"    bg1={WHITE} bg2={GRAY}  />
          <DataRow lbl="EDUCATION" val={c.education}   ar="التعليم"           bg1={GRAY}  bg2={WHITE} />

          {/* Experience */}
          <SectionHdr en="EXPERIENCE ABROAD  |" ar="الخبرة خارج البلد" />
          <DataRow lbl="EXPERIENCE" val={c.experience} ar="الخبرة" span bg1={GRAY} bg2={WHITE} />

          {/* Personal */}
          <SectionHdr en="PERSONAL DATA  |" ar="معلومات شخصية" />
          <DataRow lbl="NATIONALITY"    val={c.country}        ar="الجنسية"           bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="RELIGION"       val={c.religion}       ar="الديانة"           bg1={WHITE} bg2={GRAY}  />
          <DataRow lbl="DATE OF BIRTH"  val={c.dob}            ar="تاريخ الميلاد"     bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="PLACE OF BIRTH" val={c.birth_place}    ar="مكان الميلاد"      bg1={WHITE} bg2={GRAY}  />
          <DataRow lbl="LIVING TOWN"    val={c.living_town}    ar="مكان الإقامة"      bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="AGE"            val={c.age ?? ""}      ar="العمر"             bg1={WHITE} bg2={GRAY}  />
          <DataRow lbl="MARITAL STATUS" val={c.marital_status} ar="الحالة الاجتماعية" bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="CHILDREN"       val={c.children ?? ""} ar="عدد الأطفال"       bg1={WHITE} bg2={GRAY}  />
          <DataRow lbl="WEIGHT"         val={c.weight != null ? `${c.weight} kg` : ""} ar="الوزن" bg1={GRAY}  bg2={WHITE} />
          <DataRow lbl="HEIGHT"         val={c.height != null ? `${c.height} cm` : ""} ar="الطول" bg1={WHITE} bg2={GRAY}  />

          {/* Skills */}
          <SectionHdr en="SKILLS  |" ar="المهارات" />
          {c.skills
            ? <tr><td colSpan={4} style={td({ backgroundColor: WHITE, color: DARK })}>{c.skills}</td></tr>
            : <tr><td colSpan={4} style={td({ backgroundColor: WHITE, color: "#aaa" })}>—</td></tr>
          }

          {/* Remark */}
          <DataRow lbl="REMARK" val={c.notes ?? c.remark ?? ""} ar="" span bg1={GRAY} bg2={WHITE} />
        </tbody>
      </table>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function CvGeneratorPage() {
  const { user }  = useAuth();
  const search    = Route.useSearch();
  const [selectedId,       setSelectedId]       = useState<string | null>(search.id ?? null);
  const [selectedTemplate, setSelectedTemplate] = useState<CvTemplate | null>(null);
  const [query,            setQuery]            = useState("");
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

  const filtered = candidates.filter(
    (c) => !query || c.full_name.toLowerCase().includes(query.toLowerCase()),
  );
  const selected = candidates.find((c) => c.id === selectedId) ?? candidates[0];

  const handleDownload = async () => {
    if (!selected) return;
    setDownloading(true);
    try {
      const name = selectedTemplate
        ? `${selected.full_name} — ${selectedTemplate.name}`
        : selected.full_name;

      // DOCX template selected → fill and download as DOCX via data URL
      if (selectedTemplate) {
        const isDocx = selectedTemplate.file_url.split("?")[0].toLowerCase().endsWith(".docx");
        if (isDocx) {
          const b64 = await buildFilledDocxBase64(selectedTemplate.file_url, selected);
          const a   = document.createElement("a");
          a.href    = `data:application/octet-stream;base64,${b64}`;
          a.download = `${name}.docx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          toast.success("Filled DOCX downloaded");
          return;
        }
        // PDF template → download raw file
        const res = await fetch(selectedTemplate.file_url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = new Blob([await res.arrayBuffer()], { type: "application/octet-stream" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = `${name}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        return;
      }

      // No template → generate PDF from HTML preview
      if (!cvRef.current) return;
      const canvas = await html2canvas(cvRef.current, {
        scale: 2, backgroundColor: "#ffffff", useCORS: true, allowTaint: false,
      });
      const pxW = canvas.width / 2;
      const pxH = canvas.height / 2;
      const pdf = new jsPDF({ unit: "px", format: [pxW, pxH] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pxW, pxH);
      pdf.save(`${name}.pdf`);
      toast.success("CV downloaded as PDF");
    } catch (e: any) {
      toast.error(e.message ?? "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  // Download the raw template file for reference
  async function downloadTemplateFile(t: CvTemplate) {
    try {
      const res  = await fetch(t.file_url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ext  = t.file_url.split("?")[0].split(".").pop() ?? "pdf";
      const blob = new Blob([await res.arrayBuffer()], { type: "application/octet-stream" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${t.name}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e: any) {
      toast.error(`Download failed: ${e.message}`);
    }
  }

  const btnLabel = downloading
    ? "Downloading…"
    : selectedTemplate
      ? `Download — ${selectedTemplate.name}`
      : "Download PDF";

  return (
    <div>
      <PageHeader
        title="CV Generator"
        description="Pick a candidate, optionally select a template, then download."
        actions={
          selected && (
            <Button onClick={handleDownload} disabled={downloading}>
              <Download className="h-4 w-4 mr-2" />
              {btnLabel}
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
              <Input className="pl-9 rounded-none" placeholder="Search candidates…"
                value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </CardContent>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filtered.map((c) => (
                <button key={c.id} onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "w-full text-left rounded-none p-3 flex items-center gap-3 transition border",
                    selected?.id === c.id ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted",
                  )}
                >
                  {c.photo_url
                    ? <img src={c.photo_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                    : <Avatar className="h-9 w-9 shrink-0"><AvatarFallback>{c.full_name.slice(0,2).toUpperCase()}</AvatarFallback></Avatar>
                  }
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.country ?? "—"} · {c.occupation ?? "—"}</div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-center text-sm text-muted-foreground p-6">No candidates.</div>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Templates */}
        <Card className="w-[220px] shrink-0 flex flex-col rounded-none">
          <CardContent className="p-3 border-b">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" /> Templates
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              DOCX → filled &amp; downloaded · PDF → downloaded as-is
            </p>
          </CardContent>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {templates.length === 0
                ? <p className="text-xs text-muted-foreground text-center py-8 px-2">No templates yet.</p>
                : templates.map((t) => {
                    const isDocx = t.file_url.split("?")[0].toLowerCase().endsWith(".docx");
                    return (
                      <div key={t.id}
                        className={cn(
                          "rounded-none border p-2.5 cursor-pointer transition-colors",
                          selectedTemplate?.id === t.id
                            ? "border-primary/40 bg-primary/5"
                            : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40",
                        )}
                        onClick={() => setSelectedTemplate(selectedTemplate?.id === t.id ? null : t)}
                      >
                        <div className="flex items-start gap-2">
                          <FileText className={cn("h-3.5 w-3.5 mt-0.5 shrink-0",
                            selectedTemplate?.id === t.id ? "text-primary" : "text-muted-foreground")} />
                          <span className="text-xs font-medium flex-1 leading-tight">{t.name}</span>
                          {selectedTemplate?.id === t.id && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </div>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
                            {isDocx ? "DOCX – auto-fill" : "PDF"}
                          </span>
                          <button type="button"
                            onClick={(e) => { e.stopPropagation(); downloadTemplateFile(t); }}
                            className="text-[9px] text-primary hover:underline flex items-center gap-0.5"
                          >
                            <Download className="h-2.5 w-2.5" /> raw
                          </button>
                        </div>
                      </div>
                    );
                  })
              }
            </div>
          </ScrollArea>
          {selectedTemplate && (
            <div className="p-3 border-t bg-primary/5">
              <p className="text-[10px] text-primary font-medium truncate">✓ {selectedTemplate.name}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">
                {selectedTemplate.file_url.split("?")[0].toLowerCase().endsWith(".docx")
                  ? "Will be filled with candidate data"
                  : "PDF template will be downloaded"}
              </p>
            </div>
          )}
        </Card>

        {/* CV Preview */}
        <div className="flex-1 overflow-auto bg-muted/30 p-4">
          {selected ? (
            <div ref={cvRef} className="mx-auto shadow-xl w-fit">
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
