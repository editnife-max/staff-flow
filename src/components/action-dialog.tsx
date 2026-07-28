import React, { useEffect, useState } from "react";
import { Download, FileText, ArrowUpDown, ChevronDown, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Candidate, CvTemplate } from "@/lib/docx-fill";
import { buildFilledDocx } from "@/lib/docx-fill";
import { docxBytesToPdf, docxBytesToPdfPrint, downloadDocx, canvasToPdf, convertDocxToPdfViaCloudmersive } from "@/lib/pdf-export";
import { candidateToCanvas } from "@/components/cv-preview";

export type { CvTemplate, Candidate };

export const DOWNLOAD_TYPES = [
  { id: "summary-pdf",  label: "Download Summary (PDF)",    group: "export" as const },
  { id: "excel",        label: "Download Excel",            group: "export" as const },
  { id: "excel-ticket", label: "Download Excel for Ticket", group: "export" as const },
];

export const EXPORT_COLUMNS: { key: keyof Candidate; label: string }[] = [
  { key: "full_name",          label: "Full Name" },
  { key: "passport_number",    label: "Passport No." },
  { key: "labour_id",          label: "Labour ID" },
  { key: "narrative",          label: "Narrative" },
  { key: "medical_status",     label: "Medical Status" },
  { key: "tasheer_date",       label: "Tasheer Date" },
  { key: "tasheer_status",     label: "Tasheer" },
  { key: "narrative_phone",    label: "Narrative Phone No." },
  { key: "coc_status",         label: "COC Status" },
  { key: "ticket_status",      label: "Ticket" },
  { key: "ticket_date",        label: "Kuwait Ticket Date" },
  { key: "ticket_date",        label: "Saudi Ticket Date" },
  { key: "lmis_status",        label: "LMIS" },
  { key: "age",                label: "Age" },
  { key: "wokala_status",      label: "Wokala" },
  { key: "religion",           label: "Religion" },
  { key: "coc_agency_phone",   label: "COC Phone" },
  { key: "cv_sent_to",         label: "CV Sent To" },
  { key: "cv_sent_date",       label: "CV Sent Date" },
  { key: "medical_days",       label: "Medical Days" },
  { key: "experience_country", label: "Experience Outside" },
  { key: "visa_status",        label: "Visa Status" },
  { key: "selected_by",        label: "Selected By" },
  { key: "office",             label: "Inside Office" },
  { key: "embassy_date",       label: "Embassy Date" },
  { key: "arrival_city",       label: "Arrival City" },
  { key: "insurance_status",   label: "Insurance" },
];

export const DEFAULT_EXPORT_COLS = new Set<string>([
  "full_name", "passport_number", "labour_id", "narrative",
]);

export const TICKET_DEFAULT_COLS: (keyof Candidate)[] = [
  "full_name", "passport_number", "passport_expiry_date",
  "dob", "country", "occupation", "destination_country", "office",
];

export const SORT_FIELDS = [
  { key: "full_name",      label: "Full Name" },
  { key: "occupation",     label: "Occupation" },
  { key: "country",        label: "Nationality" },
  { key: "medical_status", label: "Medical Status" },
  { key: "coc_status",     label: "COC Status" },
  { key: "office",         label: "Office" },
];

interface ActionDialogProps {
  candidates: Candidate[];
  onClose: () => void;
}

/** Returns a Windows-safe 12-hr datetime string, e.g. "2026-07-07 09-08 PM" */
function fileTimestamp(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  let   h    = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const hh  = String(h).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}-${min} ${ampm}`;
}

export function ActionDialog({ candidates, onClose }: ActionDialogProps) {
  const { user } = useAuth();

  const { data: templates = [] } = useQuery({
    queryKey: ["cv-templates", user?.id],
    enabled: !!user && candidates.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cv_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as CvTemplate[];
    },
  });

  const [downloadType, setDownloadType] = useState("normal-cv");
  const [sortBy,       setSortBy]       = useState("full_name");
  const [sortDir,      setSortDir]      = useState<"asc" | "desc">("asc");
  const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set(DEFAULT_EXPORT_COLS));
  const [downloading, setDownloading] = useState(false);
  const [sortOpen,    setSortOpen]    = useState(false);
  const [typeOpen,    setTypeOpen]    = useState(true);
  const [colsOpen,    setColsOpen]    = useState(true);

  const isBulk = candidates.length > 1;
  const preview = candidates[0] ?? null;

  useEffect(() => {
    if (downloadType === "excel-ticket") {
      setSelectedCols(new Set(TICKET_DEFAULT_COLS as string[]));
    }
  }, [downloadType]);

  const allDownloadTypes = [
    ...DOWNLOAD_TYPES,
    ...templates.map((t) => ({ id: t.id, label: t.name, group: "cv" as const })),
  ];

  const currentType     = allDownloadTypes.find((t) => t.id === downloadType) ?? DOWNLOAD_TYPES[3];
  const isCV            = currentType.group === "cv";
  const matchedTemplate = isCV && downloadType !== "normal-cv"
    ? templates.find((t) => t.id === downloadType) ?? null
    : null;
  const isDocxTemplate  = !!matchedTemplate && matchedTemplate.file_url.split("?")[0].toLowerCase().endsWith(".docx");

  const toggleCol = (key: string) =>
    setSelectedCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const sortedCandidates = [...candidates].sort((a, b) => {
    const av = String(a[sortBy as keyof Candidate] ?? "").toLowerCase();
    const bv = String(b[sortBy as keyof Candidate] ?? "").toLowerCase();
    return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const handleDocxDownload = async () => {
    if (!matchedTemplate || !preview) return;
    setDownloading(true);
    try {
      if (isBulk) {
        toast.info(`Generating ${candidates.length} DOCX files — please wait…`);
        for (const c of sortedCandidates) {
          const bytes = await buildFilledDocx(matchedTemplate, c);
          downloadDocx(bytes, `${c.full_name} — ${currentType.label} ${fileTimestamp()}.docx`);
        }
        toast.success(`${candidates.length} DOCX files downloaded`);
      } else {
        const bytes = await buildFilledDocx(matchedTemplate, preview);
        downloadDocx(bytes, `${preview.full_name} — ${currentType.label} ${fileTimestamp()}.docx`);
        toast.success(`${currentType.label} DOCX downloaded`);
      }
    } catch (e: any) {
      toast.error(e.message ?? "DOCX download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownload = async () => {
    if (candidates.length === 0) return;
    setDownloading(true);
    try {
      if (isCV) {
        if (isBulk) {
          toast.info(`Generating ${candidates.length} PDFs via Cloudmersive — please wait…`);
          for (const c of sortedCandidates) {
            if (isDocxTemplate) {
              const bytes = await buildFilledDocx(matchedTemplate!, c);
              await convertDocxToPdfViaCloudmersive(bytes, `${c.full_name} — ${currentType.label} ${fileTimestamp()}.pdf`);
            } else {
              const canvas = await candidateToCanvas(c, matchedTemplate);
              await canvasToPdf(canvas, `${c.full_name} — ${currentType.label} ${fileTimestamp()}.pdf`, c.passport_scan_url ?? undefined);
            }
          }
          toast.success(`${candidates.length} PDFs downloaded`);
        } else {
          if (matchedTemplate) {
            const isDocx = matchedTemplate.file_url.split("?")[0].toLowerCase().endsWith(".docx");
            if (isDocx) {
              const bytes = await buildFilledDocx(matchedTemplate, preview!);
              toast.info("Converting to PDF via Cloudmersive — please wait…");
              await convertDocxToPdfViaCloudmersive(bytes, `${preview!.full_name} — ${currentType.label} ${fileTimestamp()}.pdf`);
            } else {
              const canvas = await candidateToCanvas(preview!, matchedTemplate);
              await canvasToPdf(canvas, `${preview!.full_name} — ${currentType.label} ${fileTimestamp()}.pdf`, preview!.passport_scan_url ?? undefined);
            }
            toast.success(`${currentType.label} downloaded`);
          } else {
            toast.info(`No template for "${currentType.label}" — using Normal CV format.`);
            const canvas = await candidateToCanvas(preview!, null);
            await canvasToPdf(canvas, `${preview!.full_name} — ${currentType.label} ${fileTimestamp()}.pdf`, preview!.passport_scan_url ?? undefined);
            toast.success(`${currentType.label} downloaded`);
          }
        }

      } else if (downloadType === "summary-pdf") {
        const cols = EXPORT_COLUMNS.filter((col) => selectedCols.has(col.key as string));
        if (cols.length === 0) throw new Error("Select at least one column to export.");
        const tableEl = document.createElement("div");
        tableEl.style.cssText = "position:absolute;left:-9999px;top:0;width:900px;padding:24px;background:#fff;font-family:Arial,sans-serif";
        const title = isBulk
          ? `${candidates.length} Candidates — Summary`
          : `${preview!.full_name} — Summary`;
        tableEl.innerHTML = `
          <h2 style="margin:0 0 16px;font-size:16px;color:#1a3a52;font-family:Arial,sans-serif">${title}</h2>
          <table style="width:100%;border-collapse:collapse;font-size:10px;font-family:Arial,sans-serif">
            <thead>
              <tr>${cols.map((c) => `<th style="padding:5px 8px;background:#1a3a52;color:#fff;border:1px solid #ccc;text-align:left">${c.label}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${sortedCandidates.map((cand, i) => `
                <tr style="background:${i % 2 === 0 ? "#f8f9fb" : "#fff"}">
                  ${cols.map((col) => `<td style="padding:5px 8px;border:1px solid #ddd">${String(cand[col.key] ?? "—")}</td>`).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>`;
        document.body.appendChild(tableEl);
        const { default: html2canvas } = await import("html2canvas");
        const canvas = await html2canvas(tableEl, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
        document.body.removeChild(tableEl);
        const ts = fileTimestamp();
        const fileName = isBulk ? `${candidates.length} Candidates — Summary ${ts}.pdf` : `${preview!.full_name} — Summary ${ts}.pdf`;
        await canvasToPdf(canvas, fileName);
        toast.success("Summary PDF downloaded");

      } else {
        // Excel / Excel for Ticket → .xlsx
        const cols = EXPORT_COLUMNS.filter((col) => selectedCols.has(col.key as string));
        if (cols.length === 0) throw new Error("Select at least one column to export.");
        const header = cols.map((col) => col.label);
        const rows   = sortedCandidates.map((cand) =>
          cols.map((col) => {
            const v = cand[col.key];
            return v == null ? "" : typeof v === "number" ? v : String(v);
          }),
        );
        const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
        ws["!cols"] = header.map((h, i) => ({
          wch: Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length), 10),
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Candidates");
        const buf  = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url  = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const fileName = isBulk
          ? `${candidates.length} Candidates — ${currentType.label} ${fileTimestamp()}.xlsx`
          : `${preview!.full_name} — ${currentType.label} ${fileTimestamp()}.xlsx`;
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        toast.success(`${currentType.label} downloaded`);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const title = isBulk
    ? `Action — ${candidates.length} candidates selected`
    : `Action — ${preview?.full_name ?? ""}`;

  return (
    <Dialog open={candidates.length > 0} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="rounded-none p-0 gap-0 overflow-hidden"
        style={{ maxWidth: 1400, width: "98vw", maxHeight: "92vh", display: "flex", flexDirection: "column" }}
      >
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            {isBulk && <Users className="h-4 w-4 text-primary" />}
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left panel */}
          <div className="flex-1 flex flex-col overflow-y-auto">

            {/* Sort Options */}
            <div className="border-b">
              <button type="button" onClick={() => setSortOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
                <span className="text-xs font-bold uppercase tracking-widest text-foreground/70">
                  Sort Options (for Export)
                </span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", sortOpen && "rotate-180")} />
              </button>
              {sortOpen && (
                <div className="px-4 pb-4 flex items-center gap-2">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-8 text-xs rounded-none flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SORT_FIELDS.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <button type="button" onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
                    className="h-8 w-8 shrink-0 flex items-center justify-center border rounded-none text-muted-foreground hover:bg-muted">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-xs font-medium text-muted-foreground shrink-0">{sortDir.toUpperCase()}</span>
                </div>
              )}
            </div>

            {/* Choose Download Type */}
            <div className="border-b">
              <button type="button" onClick={() => setTypeOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
                <span className="text-xs font-bold uppercase tracking-widest text-foreground/70">
                  Choose Download Type
                </span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", typeOpen && "rotate-180")} />
              </button>
              {typeOpen && (
                <div className="px-4 pb-4 space-y-0.5">
                  {allDownloadTypes.map((t) => (
                    <button key={t.id} type="button" onClick={() => setDownloadType(t.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm rounded-none border transition-colors",
                        downloadType === t.id
                          ? "border-primary/40 bg-primary/5 text-primary font-medium"
                          : "border-transparent hover:border-border hover:bg-muted/40 text-muted-foreground",
                      )}>
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Select Columns */}
            <div className="border-b flex-1 min-h-0 flex flex-col">
              <button type="button" onClick={() => setColsOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors shrink-0">
                <span className="text-xs font-bold uppercase tracking-widest text-foreground/70">
                  Select Columns
                </span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", colsOpen && "rotate-180")} />
              </button>
              {colsOpen && (
                <div className="px-4 pb-4 overflow-y-auto flex-1">
                  <div className="flex gap-3 mb-3">
                    <button type="button" onClick={() => setSelectedCols(new Set(EXPORT_COLUMNS.map((c) => c.key as string)))}
                      className="text-xs text-primary hover:underline font-medium">All</button>
                    <button type="button" onClick={() => setSelectedCols(new Set(DEFAULT_EXPORT_COLS))}
                      className="text-xs text-muted-foreground hover:underline">Default</button>
                    <button type="button" onClick={() => setSelectedCols(new Set())}
                      className="text-xs text-muted-foreground hover:underline">None</button>
                  </div>
                  <div className="grid grid-cols-4 gap-x-2 gap-y-1.5">
                    {EXPORT_COLUMNS.map((col) => {
                      const checked = selectedCols.has(col.key as string);
                      return (
                        <label key={col.label}
                          className={cn(
                            "flex items-center gap-1.5 cursor-pointer min-w-0 px-2 py-1.5 border transition-colors",
                            checked
                              ? "border-primary/30 bg-primary/5"
                              : "border-transparent bg-transparent opacity-40 hover:opacity-70",
                          )}>
                          <Checkbox checked={checked} onCheckedChange={() => toggleCol(col.key as string)} className="rounded-none h-4 w-4 shrink-0" />
                          <span className={cn("text-xs leading-tight truncate", checked ? "text-foreground font-medium" : "text-muted-foreground")}>{col.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t shrink-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isCV && !matchedTemplate && (
              <p className="text-xs text-muted-foreground">
                No template for &ldquo;{currentType.label}&rdquo; — will download as Normal CV format.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isDocxTemplate && (
              <Button variant="outline" onClick={handleDocxDownload} disabled={downloading} className="rounded-none shrink-0">
                <FileText className="h-4 w-4 mr-2" />
                {downloading
                  ? "Downloading…"
                  : isBulk
                    ? `Download ${candidates.length} × DOCX`
                    : "Download DOCX"}
              </Button>
            )}
            <Button onClick={handleDownload} disabled={downloading} className="rounded-none shrink-0">
              <Download className="h-4 w-4 mr-2" />
              {downloading
                ? "Downloading…"
                : isBulk
                  ? `Download ${candidates.length} × ${currentType.label}`
                  : `Download — ${currentType.label}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
