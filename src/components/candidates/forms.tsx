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

export function FormInput({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={type === "number" ? 0 : undefined}
        className="w-full rounded-none border border-input bg-background px-3 h-9 text-sm outline-none focus:ring-1 focus:ring-ring"
      />
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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between min-h-[20px]">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        {url && (
          <button type="button" onClick={() => downloadFile(url)}
            className="flex items-center gap-0.5 text-[11px] text-primary hover:underline">
            <Download className="h-3 w-3" /> Download
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
            "border-2 border-dashed rounded-none cursor-pointer transition-colors flex flex-col items-center justify-center gap-1.5 min-h-[90px] p-2 bg-muted/20 select-none",
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/60",
          )}
        >
          {uploading ? (
            <span className="text-xs text-muted-foreground animate-pulse">Uploading…</span>
          ) : dragOver ? (
            <><Upload className="h-5 w-5 text-primary" /><span className="text-xs text-primary">Drop to upload</span></>
          ) : url ? (
            <>
              {isImage
                ? <img src={url} alt={label} className="max-h-[60px] max-w-full object-contain rounded-none" />
                : <><ImageIcon className="h-7 w-7 text-muted-foreground" /><span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{url.split("/").pop()}</span></>}
              <span className="text-[10px] text-primary">Click to replace</span>
            </>
          ) : (
            <><Upload className="h-5 w-5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Click or drag &amp; drop</span></>
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
      <DialogContent className="max-w-2xl rounded-none">
        <DialogHeader>
          <DialogTitle className="text-base">LMIS Documents — {candidate.full_name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 pt-1">
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
