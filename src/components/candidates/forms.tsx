import React, { useId, useRef, useState } from "react";
import { Download, ImageIcon, Upload, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { Candidate } from "./types";

export async function downloadFile(url: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const ext = (url.split(".").pop()?.split("?")[0] ?? "").toLowerCase();
    const isImage = ["jpg", "jpeg", "png", "webp", "bmp"].includes(ext) || blob.type.startsWith("image/");

    if (isImage) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target!.result as string);
        reader.readAsDataURL(blob);
      });
      const img = new Image();
      await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = dataUrl; });
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: img.width > img.height ? "landscape" : "portrait", unit: "mm" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pw / img.width, ph / img.height);
      const iw = img.width * ratio;
      const ih = img.height * ratio;
      pdf.addImage(dataUrl, ext === "png" ? "PNG" : "JPEG", (pw - iw) / 2, (ph - ih) / 2, iw, ih);
      pdf.save("lmis_file.pdf");
    } else {
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = "lmis_file.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
    }
  } catch {
    toast.error("Download failed");
  }
}

export function Field({ label, value, onChange, type = "text", placeholder, maxLength, suggestions }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; maxLength?: number; suggestions?: string[] }) {
  const listId = useId();
  const hasSugg = (suggestions?.length ?? 0) > 0;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-none h-9" placeholder={placeholder} maxLength={maxLength} list={hasSugg ? listId : undefined} />
      {hasSugg && <datalist id={listId}>{suggestions!.map((s) => <option key={s} value={s} />)}</datalist>}
    </div>
  );
}

export function FormSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="rounded-none h-9"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export function FormInput({ label, value, onChange, placeholder, type = "text", suggestions }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; suggestions?: string[] }) {
  const listId = suggestions?.length ? `fl-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={type === "number" ? 0 : undefined}
        list={listId}
        className="w-full rounded-none border border-input bg-background px-3 h-9 text-sm outline-none focus:ring-1 focus:ring-ring"
      />
      {listId && (
        <datalist id={listId}>
          {suggestions!.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  );
}

export function PhotoUpload({ label, value, onChange, accept = "image/*" }: { label: string; value: string; onChange: (url: string) => void; accept?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("candidate-files").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("candidate-files").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const isImage = value && !value.endsWith(".pdf");

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <div
          role="button" tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          className={`border-2 border-dashed rounded-none cursor-pointer transition-colors flex flex-col items-center justify-center gap-1.5 min-h-[88px] p-2 bg-muted/20 select-none ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"}`}
        >
          {uploading ? (
            <span className="text-xs text-muted-foreground animate-pulse">Uploading…</span>
          ) : dragOver ? (
            <>
              <Upload className="h-5 w-5 text-primary" />
              <span className="text-xs text-primary">Drop to upload</span>
            </>
          ) : value ? (
            <>
              {isImage ? (
                <img src={value} alt={label} className="max-h-[60px] max-w-full object-contain rounded-none" />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{value.split("/").pop()}</span>
                </div>
              )}
              <span className="text-[10px] text-primary">Click or drop to replace</span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Click or drag &amp; drop</span>
            </>
          )}
        </div>
        {value && !uploading && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="absolute top-1 right-1 h-5 w-5 flex items-center justify-center rounded-none bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors"
            title="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}

export function LmisDocSection({
  label, url, onUpload, onRemove,
}: {
  label: string; url: string;
  onUpload: (f: File) => Promise<void>;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const handleFile = async (file: File) => {
    setUploading(true);
    try { await onUpload(file); }
    catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };
  const isImage = url && !url.endsWith(".pdf");
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between min-h-[18px]">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        {url && (
          <button type="button" onClick={() => downloadFile(url)}
            className="flex items-center gap-0.5 text-[10px] text-primary hover:underline">
            <Download className="h-2.5 w-2.5" /> DL
          </button>
        )}
      </div>
      <div className="relative">
        <div
          role="button" tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          className={cn(
            "border-2 border-dashed rounded-none cursor-pointer transition-colors flex flex-col items-center justify-center gap-1 min-h-[56px] p-1.5 bg-muted/20 select-none",
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/60",
          )}
        >
          {uploading ? (
            <span className="text-[10px] text-muted-foreground animate-pulse">Uploading…</span>
          ) : dragOver ? (
            <><Upload className="h-4 w-4 text-primary" /><span className="text-[10px] text-primary">Drop</span></>
          ) : url ? (
            <>
              {isImage
                ? <img src={url} alt={label} className="max-h-[40px] max-w-full object-contain rounded-none" />
                : <><ImageIcon className="h-5 w-5 text-muted-foreground" /><span className="text-[9px] text-muted-foreground truncate max-w-[100px]">{url.split("/").pop()}</span></>}
              <span className="text-[9px] text-primary">Replace</span>
            </>
          ) : (
            <><Upload className="h-4 w-4 text-muted-foreground" /><span className="text-[10px] text-muted-foreground">Upload</span></>
          )}
        </div>
        {url && !uploading && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-1 right-1 h-5 w-5 flex items-center justify-center rounded-none bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}

export function LmisFilesDialog({
  candidate, onUpdateField, onClose,
}: {
  candidate: Candidate;
  onUpdateField: (field: string, value: string | null) => void;
  onClose: () => void;
}) {
  const c = candidate as any;
  const insuUrl: string = c.lmis_insu_url ?? "";
  const cocUrl: string = c.lmis_coc_url ?? "";
  const idUrl: string = c.lmis_id_url ?? "";
  const idRelUrl: string = c.lmis_id_relative_url ?? "";
  const enjazUrl: string = c.lmis_enjaz_url ?? "";
  const contractUrl: string = c.lmis_contract_url ?? "";
  const passportUrl: string = c.lmis_passport_url ?? "";
  const hasBothIds = !!(idUrl && idRelUrl);

  const upload = async (file: File, field: string) => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `lmis/${candidate.id}/${field}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("candidate-files").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("candidate-files").getPublicUrl(path);
    onUpdateField(field, data.publicUrl);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl rounded-none">
        <DialogHeader>
          <DialogTitle className="text-base">LMIS Documents — {candidate.full_name}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[80vh] overflow-y-auto pr-1 space-y-4">
        <div className="grid grid-cols-3 gap-3 pt-1">
          <LmisDocSection label="INSU" url={insuUrl}
            onUpload={(f) => upload(f, "lmis_insu_url")}
            onRemove={() => onUpdateField("lmis_insu_url", null)} />
          <LmisDocSection label="COC" url={cocUrl}
            onUpload={(f) => upload(f, "lmis_coc_url")}
            onRemove={() => onUpdateField("lmis_coc_url", null)} />
          <LmisDocSection label={hasBothIds ? "ID'S — Candidate" : "ID (Candidate)"} url={idUrl}
            onUpload={(f) => upload(f, "lmis_id_url")}
            onRemove={() => onUpdateField("lmis_id_url", null)} />
          <LmisDocSection label={hasBothIds ? "ID'S — Relative" : "ID (Relative)"} url={idRelUrl}
            onUpload={(f) => upload(f, "lmis_id_relative_url")}
            onRemove={() => onUpdateField("lmis_id_relative_url", null)} />
          <LmisDocSection label="Enjaz" url={enjazUrl}
            onUpload={(f) => upload(f, "lmis_enjaz_url")}
            onRemove={() => onUpdateField("lmis_enjaz_url", null)} />
          <LmisDocSection label="Contract" url={contractUrl}
            onUpload={(f) => upload(f, "lmis_contract_url")}
            onRemove={() => onUpdateField("lmis_contract_url", null)} />
          <LmisDocSection label="Passport" url={passportUrl}
            onUpload={(f) => upload(f, "lmis_passport_url")}
            onRemove={() => onUpdateField("lmis_passport_url", null)} />
        </div>
        {(() => {
          const ca = candidate as any;
          const fmtDate = (d: string | null | undefined) => {
            if (!d) return null;
            const dt = new Date(d + "T00:00:00");
            return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
          };
          const fields = [
            { label: "Visa Number",            value: ca.musaned_visa_number },
            { label: "Employer City",          value: ca.musaned_employer_city },
            { label: "Employer Name",          value: ca.musaned_employer_name },
            { label: "Phone",                  value: ca.musaned_employer_phone },
            { label: "House No.",              value: ca.musaned_house_number },
            { label: "Beginning of Contract",  value: fmtDate(ca.musaned_contract_start) },
            { label: "Ending of Contract",     value: fmtDate(ca.musaned_contract_end) },
          ];
          return (
            <div className="mt-4 rounded-none border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
                <svg className="h-3.5 w-3.5 text-teal-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                <span className="text-[11px] font-semibold tracking-wider uppercase text-foreground/70">Musaned Info</span>
                {fields.some((f) => f.value) && (
                  <span className="ml-auto text-[10px] font-medium text-teal-600 bg-teal-50 dark:bg-teal-950/40 dark:text-teal-400 px-1.5 py-0.5 rounded-sm border border-teal-200 dark:border-teal-800">Fetched</span>
                )}
              </div>
              <div className="grid grid-cols-2 divide-x divide-y divide-border">
                {fields.map(({ label, value }) => (
                  <div key={label} className="px-3 py-2 flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                    {value
                      ? <span className="text-[13px] font-medium text-foreground">{value}</span>
                      : <span className="text-[12px] text-muted-foreground/50 italic">Unavailable</span>
                    }
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TicketFilesDialog({
  candidate, onUpdateField, onClose, showReturnFiles,
}: {
  candidate: Candidate;
  onUpdateField: (field: string, value: string | null) => void;
  onClose: () => void;
  showReturnFiles?: boolean;
}) {
  const c = candidate as any;
  const upload = async (file: File, field: string) => {
    const ext = file.name.split(".").pop() ?? "pdf";
    const path = `ticket-pdfs/${candidate.id}/${field}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("candidate-files").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("candidate-files").getPublicUrl(path);
    onUpdateField(field, data.publicUrl);
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl rounded-none">
        <DialogHeader>
          <DialogTitle className="text-base">Ticket Documents — {candidate.full_name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-4 pt-1">
          <LmisDocSection label="Ticket PDF" url={c.ticket_pdf_url ?? ""}
            onUpload={(f) => upload(f, "ticket_pdf_url")}
            onRemove={() => onUpdateField("ticket_pdf_url", null)} />
          <LmisDocSection label="QR" url={c.qr_url ?? ""}
            onUpload={(f) => upload(f, "qr_url")}
            onRemove={() => onUpdateField("qr_url", null)} />
          <LmisDocSection label="Visa" url={c.visa_pdf_url ?? ""}
            onUpload={(f) => upload(f, "visa_pdf_url")}
            onRemove={() => onUpdateField("visa_pdf_url", null)} />
        </div>
        {showReturnFiles && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-t border-border pt-3">Return Documents</p>
            <div className="grid grid-cols-3 gap-4">
              <LmisDocSection label="Return Ticket" url={c.return_ticket_url ?? ""}
                onUpload={(f) => upload(f, "return_ticket_url")}
                onRemove={() => onUpdateField("return_ticket_url", null)} />
              <LmisDocSection label="Stamp" url={c.stamp_url ?? ""}
                onUpload={(f) => upload(f, "stamp_url")}
                onRemove={() => onUpdateField("stamp_url", null)} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function FormSection({ title, children, required }: { title: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 pb-1 border-b border-border flex items-center gap-1">
        {title}
        {required && <span className="text-destructive text-xs normal-case tracking-normal">— required</span>}
      </p>
      {children}
    </div>
  );
}
