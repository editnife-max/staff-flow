import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { checkWafidMedical } from "@/lib/candidates.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Play, Download, Loader2, ChevronLeft, ChevronRight, ChevronUp,
  RotateCcw, SlidersHorizontal, Stethoscope, Pencil, Globe, Lock, Undo2, History,
} from "lucide-react";
import { cn, calcAge } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "sonner";
import {
  MEDICAL_OPTIONS, COC_OPTIONS, TASHEER_OPTIONS, WOKALA_OPTIONS, VISA_OPTIONS,
  INSURANCE_OPTIONS, LMIS_OPTIONS, UNFILLED_LMIS_OPTIONS, TICKET_OPTIONS,
  ARRIVAL_CITY_OPTIONS, OFFICE_OPTIONS, PASSPORT_OPTIONS,
  medDaysAgo, CANDIDATE_CARD_COLS, firstName, CV_REQ_KEY_MGR, checkMeetsCvReq,
} from "./types";
import type { Candidate, Status, EditableField } from "./types";
import { InlineDate, InlineText, InlineSelect } from "./atoms";
import { LmisDocSection, TicketFilesDialog, downloadFile } from "./forms";
import { CancelReasonDialog, ReturnReasonDialog, CandidateDetailDialog, CandidatePhotosDialog } from "./dialogs";

export function ProcessingEditDialog({
  candidate, onClose, onUpdateField, agencyOptions, countryOptions, officesByCountry, narrativeSuggestions,
}: {
  candidate: Candidate;
  onClose: () => void;
  onUpdateField: (field: string, value: string | null) => void;
  agencyOptions: string[];
  countryOptions: string[];
  officesByCountry: Record<string, string[]>;
  narrativeSuggestions?: string[];
}) {
  const init = {
    passport_number:   candidate.passport_number   ?? "",
    labour_id:         candidate.labour_id         ?? "",
    narrative:         candidate.narrative         ?? "",
    narrative_phone:   candidate.narrative_phone   ?? "",
    contract_date:     candidate.contract_date     ?? "",
    medical_status:    candidate.medical_status    ?? "",
    medical_date:      candidate.medical_date      ?? "",
    medical_days:      (candidate as any).medical_days      ?? "",
    coc_status:        candidate.coc_status        ?? "",
    tasheer_status:    candidate.tasheer_status    ?? "",
    tasheer_date:      candidate.tasheer_date      ?? "",
    wokala_status:     candidate.wokala_status     ?? "",
    embassy_date:      (candidate as any).embassy_date      ?? "",
    visa_status:       candidate.visa_status       ?? "",
    insurance_status:  candidate.insurance_status  ?? "",
    unfilled_lmis:     candidate.unfilled_lmis     ?? "",
    lmis_status:       candidate.lmis_status       ?? "",
    ticket_status:     candidate.ticket_status     ?? "",
    ticket_date:       candidate.ticket_date       ?? "",
    arrival_city:      candidate.arrival_city      ?? "",
    processing_notes:  (candidate as any).processing_notes  ?? "",
    emergency_contact: (candidate as any).emergency_contact ?? "",
    destination_country: candidate.destination_country ?? "",
    office:            candidate.office            ?? "",
  };
  const [form, setForm] = useState(init);
  const set = (k: keyof typeof init) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function handleSave() {
    const saved = { ...form };
    if (saved.medical_status === "Fit") {
      const dateToCheck = saved.medical_date || init.medical_date;
      if (dateToCheck && medDaysAgo(dateToCheck) >= 90) {
        saved.medical_status = "Expired";
        toast.error("Medical date is over 90 days ago — status set to Expired");
      }
    }
    for (const key of Object.keys(init) as (keyof typeof init)[]) {
      if (saved[key] !== init[key]) onUpdateField(key, saved[key] || null);
    }
    onClose();
  }

  const ProcSelect = ({ label, k, options }: { label: string; k: keyof typeof init; options: string[] }) => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select value={form[k]} onChange={(e) => set(k)(e.target.value)}
        className="w-full rounded-none border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
  const ProcInput = ({ label, k, type = "text", suggestions }: { label: string; k: keyof typeof init; type?: string; suggestions?: string[] }) => {
    const hasSugg = (suggestions?.length ?? 0) > 0;
    const listId = `proc-input-${k}-list`;
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <Input type={type} value={form[k]} onChange={(e) => set(k)(e.target.value)}
          className="rounded-none h-8 text-sm" list={hasSugg ? listId : undefined} />
        {hasSugg && <datalist id={listId}>{suggestions!.map((s) => <option key={s} value={s} />)}</datalist>}
      </div>
    );
  };

  const isLocked = candidate.visa_status === "Waiting Replacement";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Edit Processing — {candidate.full_name}</DialogTitle>
        </DialogHeader>
        {isLocked && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-300 dark:bg-amber-950/40 dark:border-amber-700 rounded-none text-sm text-amber-800 dark:text-amber-300">
            <span className="text-base">🔒</span>
            <span><strong>Locked</strong> — Visa Status is <strong>Waiting Replacement</strong>. Changes are not allowed until the visa status is updated.</span>
          </div>
        )}
        <div className={isLocked ? "pointer-events-none opacity-50 max-h-[65vh] overflow-y-auto pr-1 space-y-4" : "max-h-[65vh] overflow-y-auto pr-1 space-y-4"}>
          <div className="grid grid-cols-2 gap-3">
            <ProcInput label="Passport No" k="passport_number" />
            <ProcInput label="Labour ID" k="labour_id" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ProcInput label="Narrative" k="narrative" suggestions={narrativeSuggestions} />
            <ProcInput label="Narrative Phone" k="narrative_phone" />
            <ProcInput label="Contract Date" k="contract_date" type="date" />
            <ProcInput label="Emergency Contact" k="emergency_contact" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ProcSelect label="Medical Status" k="medical_status" options={MEDICAL_OPTIONS} />
            <ProcInput label="Medical Date" k="medical_date" type="date" />
            <ProcInput label="Medical Days" k="medical_days" />
            <ProcSelect label="COC Status" k="coc_status" options={COC_OPTIONS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ProcSelect label="Tasheer" k="tasheer_status" options={TASHEER_OPTIONS} />
            <ProcInput label="Tasheer Date" k="tasheer_date" type="date" />
            <ProcSelect label="Wokala" k="wokala_status" options={WOKALA_OPTIONS} />
            <ProcInput label="Embassy Date" k="embassy_date" type="date" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ProcSelect label="Visa Status" k="visa_status" options={VISA_OPTIONS} />
            <ProcSelect label="Insurance" k="insurance_status" options={INSURANCE_OPTIONS} />
            <ProcSelect label="LMIS file" k="unfilled_lmis" options={UNFILLED_LMIS_OPTIONS} />
            <ProcSelect label="LMIS" k="lmis_status" options={LMIS_OPTIONS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ProcSelect label="Ticket" k="ticket_status" options={TICKET_OPTIONS} />
            <ProcInput label="Ticket Date" k="ticket_date" type="date" />
            <ProcSelect label="Arrival City" k="arrival_city" options={ARRIVAL_CITY_OPTIONS} />
            <ProcInput label="Processing Note" k="processing_notes" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">TICKET FILES</label>
            <div className="grid grid-cols-3 gap-3">
              <LmisDocSection
                label="Ticket PDF"
                url={(candidate as any).ticket_pdf_url ?? ""}
                onUpload={async (f) => {
                  const ext = f.name.split(".").pop() ?? "pdf";
                  const path = `ticket-pdfs/${candidate.id}/ticket_${Date.now()}.${ext}`;
                  const { error } = await supabase.storage.from("candidate-files").upload(path, f, { upsert: true });
                  if (error) throw error;
                  const { data } = supabase.storage.from("candidate-files").getPublicUrl(path);
                  onUpdateField("ticket_pdf_url", data.publicUrl);
                }}
                onRemove={() => onUpdateField("ticket_pdf_url", null)}
              />
              <LmisDocSection
                label="QR"
                url={(candidate as any).qr_url ?? ""}
                onUpload={async (f) => {
                  const ext = f.name.split(".").pop() ?? "pdf";
                  const path = `ticket-pdfs/${candidate.id}/qr_${Date.now()}.${ext}`;
                  const { error } = await supabase.storage.from("candidate-files").upload(path, f, { upsert: true });
                  if (error) throw error;
                  const { data } = supabase.storage.from("candidate-files").getPublicUrl(path);
                  onUpdateField("qr_url", data.publicUrl);
                }}
                onRemove={() => onUpdateField("qr_url", null)}
              />
              <LmisDocSection
                label="Visa"
                url={(candidate as any).visa_pdf_url ?? ""}
                onUpload={async (f) => {
                  const ext = f.name.split(".").pop() ?? "pdf";
                  const path = `ticket-pdfs/${candidate.id}/visa_${Date.now()}.${ext}`;
                  const { error } = await supabase.storage.from("candidate-files").upload(path, f, { upsert: true });
                  if (error) throw error;
                  const { data } = supabase.storage.from("candidate-files").getPublicUrl(path);
                  onUpdateField("visa_pdf_url", data.publicUrl);
                }}
                onRemove={() => onUpdateField("visa_pdf_url", null)}
              />
            </div>
          </div>
          {countryOptions.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <ProcSelect label="Country" k="destination_country" options={countryOptions} />
              <ProcSelect label="Office" k="office" options={officesByCountry[form.destination_country] ?? []} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isLocked}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CandidateCardList({
  candidates, selected, onToggleSelect, onView, onAction, onEdit, onDelete, onUpdateField, cancelMode, onReturn, onUndo,
  countryMeta, officesByCountry, agencyOptions, agencyPhones, compact, narrativeSuggestions, showCvBadge, pageKey,
}: {
  candidates: Candidate[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onView: (c: Candidate) => void;
  onAction: (c: Candidate) => void;
  onEdit: (c: Candidate) => void;
  onDelete: (id: string) => void;
  onUpdateField: (id: string, field: string, value: string | null) => void;
  cancelMode?: boolean;
  compact?: boolean;
  showCvBadge?: boolean;
  onReturn?: (id: string) => void;
  onUndo?: (id: string, c: Candidate) => void;
  countryMeta: Array<{ name: string; flag: string }>;
  officesByCountry: Record<string, string[]>;
  agencyOptions: string[];
  agencyPhones: Record<string, string>;
  narrativeSuggestions?: string[];
  pageKey: string;
}) {
  const cvReq = useMemo(() => {
    if (!showCvBadge) return null;
    try {
      const saved = localStorage.getItem(CV_REQ_KEY_MGR);
      return saved ? JSON.parse(saved) as Record<string, string> : null;
    } catch { return null; }
  }, [showCvBadge]);
  const [viewingPhotos, setViewingPhotos] = useState<Candidate | null>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    try {
      const s = sessionStorage.getItem("mgr-hidden-cols-avail");
      if (s) return new Set(JSON.parse(s));
    } catch {}
    return new Set(["ADDED BY", "GENDER", "LIVING TOWN", "OFFICE", "CONTRACT DATE", "TICKET PDF"]);
  });
  useEffect(() => {
    sessionStorage.setItem("mgr-hidden-cols-avail", JSON.stringify(Array.from(hiddenCols)));
  }, [hiddenCols]);
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showColPicker) return;
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node))
        setShowColPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColPicker]);
  const [activeCountryTab, setActiveCountryTab] = useState(() => {
    try { return sessionStorage.getItem(`mgr-card-country-${pageKey}`) || "all"; } catch { return "all"; }
  });
  const [activeOfficeTab, setActiveOfficeTab] = useState(() => {
    try { return sessionStorage.getItem(`mgr-card-office-${pageKey}`) || "all"; } catch { return "all"; }
  });
  useEffect(() => { try { sessionStorage.setItem(`mgr-card-country-${pageKey}`, activeCountryTab); } catch {} }, [activeCountryTab, pageKey]);
  useEffect(() => { try { sessionStorage.setItem(`mgr-card-office-${pageKey}`, activeOfficeTab); } catch {} }, [activeOfficeTab, pageKey]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    const mirror = mirrorRef.current;
    if (!el) return;
    const sync = () => {
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
      if (fadeRef.current) fadeRef.current.style.opacity = (!atEnd && el.scrollWidth > el.clientWidth) ? "1" : "0";
      if (mirror) mirror.scrollLeft = el.scrollLeft;
    };
    const syncWidth = () => {
      if (mirror) {
        const inner = mirror.firstElementChild as HTMLElement;
        if (inner) inner.style.width = el.scrollWidth + "px";
      }
    };
    const onMirrorScroll = () => { if (mirror) el.scrollLeft = mirror.scrollLeft; };
    sync(); syncWidth();
    const raf = requestAnimationFrame(() => { sync(); syncWidth(); });
    el.addEventListener("scroll", sync, { passive: true });
    if (mirror) mirror.addEventListener("scroll", onMirrorScroll, { passive: true });
    const ro = new ResizeObserver(() => { sync(); syncWidth(); });
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => { cancelAnimationFrame(raf); el.removeEventListener("scroll", sync); mirror?.removeEventListener("scroll", onMirrorScroll); ro.disconnect(); };
  }, []);
  const countryOptions = useMemo(() => countryMeta.map((c) => c.name), [countryMeta]);

  useEffect(() => {
    for (const c of candidates) {
      if (c.medical_status === "Fit" && c.medical_date && medDaysAgo(c.medical_date) >= 90) {
        onUpdateField(c.id, "medical_status", "Expired");
      }
    }
  }, [candidates]);

  const matchesCountry = (c: Candidate, country: string) =>
    c.destination_country === country || c.musaned_status === country;

  const filtered = useMemo(() => {
    let list = candidates;
    if (activeCountryTab !== "all") list = list.filter((c) => matchesCountry(c, activeCountryTab));
    if (activeOfficeTab !== "all") list = list.filter((c) => c.office === activeOfficeTab);
    return list;
  }, [candidates, activeCountryTab, activeOfficeTab]);

  const [page, setPage] = useState(() => {
    try { return Math.max(1, parseInt(sessionStorage.getItem(`mgr-card-page-${pageKey}`) || "1", 10)); } catch { return 1; }
  });
  const [pageSize, setPageSize] = useState(() => {
    try { return parseInt(sessionStorage.getItem(`mgr-card-pgsz-${pageKey}`) || "5", 10) || 5; } catch { return 5; }
  });
  useEffect(() => { try { sessionStorage.setItem(`mgr-card-page-${pageKey}`, String(page)); } catch {} }, [page, pageKey]);
  useEffect(() => { try { sessionStorage.setItem(`mgr-card-pgsz-${pageKey}`, String(pageSize)); } catch {} }, [pageSize, pageKey]);
  const firstMountCardRef = useRef(true);
  useEffect(() => {
    if (firstMountCardRef.current) { firstMountCardRef.current = false; return; }
    setPage(1);
  }, [filtered.length, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const allSel = paginated.length > 0 && paginated.every((c) => selected.has(c.id));
  const someSel = !allSel && paginated.some((c) => selected.has(c.id));
  const visibleCols = (CANDIDATE_CARD_COLS as readonly string[]).filter((l) => {
    if (l === "TICKET PDF") return !!compact;
    if (hiddenCols.has(l)) return false;
    return true;
  });

  return (
    <div className="space-y-2">
      {countryMeta.length > 0 && (
        <Card className="rounded-none">
          <CardContent className="px-3 py-2">
            <div className="flex items-center gap-1 flex-wrap">
              <button type="button"
                onClick={() => { setActiveCountryTab("all"); setActiveOfficeTab("all"); }}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-none border transition-colors",
                  activeCountryTab === "all"
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40")}>
                All ({candidates.length})
              </button>
              {countryMeta.map((c) => {
                const count = candidates.filter((cand) => matchesCountry(cand, c.name)).length;
                return (
                  <button key={c.name} type="button"
                    onClick={() => { setActiveCountryTab(activeCountryTab === c.name ? "all" : c.name); setActiveOfficeTab("all"); }}
                    className={cn("px-3 py-1.5 text-xs font-medium rounded-none border transition-colors flex items-center gap-1.5",
                      activeCountryTab === c.name
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40")}>
                    <span>{c.flag}</span>{c.name}<span className="opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      {activeCountryTab !== "all" && (officesByCountry[activeCountryTab] ?? []).length > 0 && (
        <Card className="rounded-none">
          <CardContent className="px-3 py-2">
            <div className="flex items-center gap-1 flex-wrap">
              <button type="button" onClick={() => setActiveOfficeTab("all")}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-none border transition-colors",
                  activeOfficeTab === "all"
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40")}>
                All offices
              </button>
              {(officesByCountry[activeCountryTab] ?? []).map((office) => {
                const count = candidates.filter((c) => matchesCountry(c, activeCountryTab) && c.office === office).length;
                return (
                  <button key={office} type="button"
                    onClick={() => setActiveOfficeTab(activeOfficeTab === office ? "all" : office)}
                    className={cn("px-3 py-1.5 text-xs font-medium rounded-none border transition-colors flex items-center gap-1.5",
                      activeOfficeTab === office
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40")}>
                    {office}<span className="opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <Checkbox
              checked={allSel ? true : someSel ? "indeterminate" : false}
              onCheckedChange={(v) =>
                paginated.forEach((c) => { if (!!v !== selected.has(c.id)) onToggleSelect(c.id); })
              }
            />
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </label>
          <div className="flex items-center gap-1">
            {hiddenCols.size > 0 && (
              <Button
                size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground"
                onClick={() => setHiddenCols(new Set())}
              >
                <RotateCcw className="h-3 w-3" /> Reset columns
              </Button>
            )}
            <div className="relative" ref={colPickerRef}>
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                onClick={() => setShowColPicker((v) => !v)}>
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Columns
                {hiddenCols.size > 0 && (
                  <span className="ml-1 rounded-none bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">
                    {hiddenCols.size} hidden
                  </span>
                )}
              </Button>
              {showColPicker && (
                <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-none shadow-xl p-3 w-[340px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Columns</span>
                    <button type="button" onClick={() => setHiddenCols(new Set())}
                      className="text-[11px] text-primary hover:underline disabled:opacity-40"
                      disabled={hiddenCols.size === 0}>
                      Reset
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {CANDIDATE_CARD_COLS.filter((l) => l !== "TICKET PDF" || compact).map((label) => (
                      <label key={label} className="flex items-center gap-1.5 text-xs cursor-pointer py-1 hover:text-primary">
                        <Checkbox
                          checked={!hiddenCols.has(label)}
                          onCheckedChange={(v) =>
                            setHiddenCols((prev) => { const n = new Set(prev); v ? n.delete(label) : n.add(label); return n; })
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">No candidates here yet.</CardContent></Card>
      ) : (
        <div className="relative">
          <div ref={scrollRef} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-2 min-w-max">
              {paginated.map((c) => (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  selected={selected.has(c.id)}
                  visibleCols={visibleCols}
                  cancelMode={cancelMode}
                  compact={compact}
                  meetsCvReq={cvReq ? checkMeetsCvReq(c, cvReq) : false}
                  onToggleSelect={() => onToggleSelect(c.id)}
                  onViewPhotos={() => setViewingPhotos(c)}
                  onView={() => onView(c)}
                  onAction={() => onAction(c)}
                  onEdit={() => onEdit(c)}
                  onDelete={() => onDelete(c.id)}
                  onUpdateField={(field, value) => onUpdateField(c.id, field, value)}
                  onReturn={onReturn ? () => onReturn(c.id) : undefined}
                  onUndo={onUndo ? () => onUndo(c.id, c) : undefined}
                  agencyOptions={agencyOptions}
                  agencyPhones={agencyPhones}
                  countryOptions={countryOptions}
                  narrativeSuggestions={narrativeSuggestions}
                />
              ))}
            </div>
          </div>
          <div ref={fadeRef} aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent opacity-0 transition-opacity duration-200" />
        </div>
      )}
      <CandidatePhotosDialog candidate={viewingPhotos} onClose={() => setViewingPhotos(null)} />
      {filtered.length > 0 && (
        <div className="sticky bottom-0 z-10 bg-background shadow-[0_-1px_3px_rgba(0,0,0,0.06)]">
          <div ref={mirrorRef} className="w-full" style={{ overflowX: "scroll", overflowY: "hidden", height: 16 }}><div style={{ height: 1 }} /></div>
          <div className="flex items-center justify-between px-4 py-2 flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-none" disabled={page === 1}
              onClick={() => { setPage((p) => p - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
              .map((n, i, arr) => (
                <React.Fragment key={n}>
                  {i > 0 && n - arr[i - 1] > 1 && <span className="text-xs text-muted-foreground px-0.5">…</span>}
                  <Button size="sm" variant={page === n ? "default" : "outline"}
                    className="h-7 w-7 p-0 rounded-none text-xs"
                    onClick={() => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                    {n}
                  </Button>
                </React.Fragment>
              ))}
            <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-none" disabled={page === totalPages}
              onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            {[5, 10, 50, 100, 500].map((s) => (
              <Button key={s} size="sm" variant={pageSize === s ? "default" : "outline"}
                className="h-7 px-2 rounded-none text-xs"
                onClick={() => { setPageSize(s); setPage(1); }}>
                {s}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
            </span>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs font-bold text-black"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              <ChevronUp className="h-3.5 w-3.5" /> Back to top
            </Button>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoCell({ url, onSave, candidateName }: { url: string | null; onSave: (v: string | null) => void; candidateName: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(url ?? "");
  const [dlLoading, setDlLoading] = useState(false);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); onSave(draft.trim() || null); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraft(url ?? ""); setEditing(false); }
        }}
        placeholder="Paste video URL…"
        className="rounded-none border border-primary bg-background px-1 py-0.5 text-[12px] outline-none w-[80px]"
      />
    );
  }

  if (url) {
    const fileName = `${candidateName}.mp4`;
    const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
    const downloadUrl = gdMatch
      ? `https://drive.google.com/uc?export=download&id=${gdMatch[1]}`
      : url;

    const handleDownload = async () => {
      if (gdMatch) {
        window.open(downloadUrl, "_blank");
        return;
      }
      if (dlLoading) return;
      setDlLoading(true);
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      } catch {
        window.open(url, "_blank");
      } finally {
        setDlLoading(false);
      }
    };
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => window.open(url, "_blank")}
            className="flex items-center gap-0.5 text-[11px] text-primary hover:underline font-medium">
            <Play className="h-3 w-3 fill-current" /> Play
          </button>
          <button type="button" onClick={handleDownload} disabled={dlLoading}
            className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50">
            {dlLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          </button>
        </div>
        <button type="button" onClick={() => { setDraft(url); setEditing(true); }}
          className="text-[10px] text-muted-foreground hover:underline text-left">
          Change
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)}
      className="text-[11px] text-muted-foreground hover:text-foreground rounded-none px-1 -mx-1 py-0.5 hover:bg-muted/60 hover:ring-1 hover:ring-border block">
      Add URL
    </button>
  );
}

const HISTORY_FIELD_LABELS: Record<string, string> = {
  visa_status:    "Visa Status",
  ticket_status:  "Ticket Status",
  ticket_date:    "Ticket Date",
  arrival_city:   "Arrival City",
  medical_status: "Medical Status",
  medical_date:   "Medical Date",
  tasheer_status: "Tasheer Status",
  tasheer_date:   "Tasheer Date",
  wokala_status:  "Wokala Status",
  lmis_status:    "LMIS Status",
  coc_status:     "COC Status",
  insurance_status:"Insurance",
  insurance_date: "Insurance Date",
  status:         "Availability",
  selected_by:    "Selected By",
  processing_notes:"Notes",
  passport_accepted:"Passport Accepted",
  flight_readiness: "Flight Readiness",
};

export function CandidateHistoryDialog({ candidateId, candidateName, createdAt, createdByName, createdByUserId, open, onClose }: {
  candidateId: string;
  candidateName: string;
  createdAt: string;
  createdByName: string | null | undefined;
  createdByUserId: string | null | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["candidate-history", candidateId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidate_field_log")
        .select("id, field, old_value, new_value, changed_by_name, changed_by_user_id, changed_at")
        .eq("candidate_id", candidateId)
        .order("changed_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const fmtTs = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const DATE_FIELDS = new Set(["ticket_date", "tasheer_date", "medical_date", "insurance_date", "contract_date", "embassy_date", "coc_booked_date"]);
  const fmtVal = (field: string, val: string | null) => {
    if (!val) return null;
    if (DATE_FIELDS.has(field)) {
      return new Date(val + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
    return val;
  };

  const totalEntries = 1 + logs.length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg rounded-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Change History — {candidateName}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border border border-border rounded-none">
            <div className="flex items-start gap-3 px-4 py-2.5">
              <div className="flex flex-col items-center shrink-0 pt-[3px]">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-500/70" />
                {totalEntries > 1 && <div className="w-px flex-1 bg-border mt-1" style={{ minHeight: 12 }} />}
              </div>
              <div className="flex-1 min-w-0 pb-0.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  Candidate Added
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  by <span className="font-medium text-foreground">
                    {createdByUserId === user?.id ? "you" : (createdByName || "—")}
                  </span>
                  {" · "}
                  {fmtTs(createdAt)}
                </div>
              </div>
            </div>
            {logs.map((log, i) => (
              <div key={log.id} className="flex items-start gap-3 px-4 py-2.5">
                <div className="flex flex-col items-center shrink-0 pt-[3px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                  {i < logs.length - 1 && <div className="w-px flex-1 bg-border mt-1" style={{ minHeight: 12 }} />}
                </div>
                <div className="flex-1 min-w-0 pb-0.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                    {HISTORY_FIELD_LABELS[log.field] ?? log.field}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                    <span className={log.old_value ? "text-muted-foreground line-through" : "text-muted-foreground/50 italic"}>
                      {fmtVal(log.field, log.old_value) ?? "empty"}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-semibold text-foreground">
                      {fmtVal(log.field, log.new_value) ?? <em className="font-normal text-muted-foreground/60">cleared</em>}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    by <span className="font-medium text-foreground">
                      {(log as any).changed_by_user_id === user?.id ? "you" : log.changed_by_name}
                    </span>
                    {" · "}
                    {fmtTs(log.changed_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CandidateCard({
  candidate, selected, visibleCols, onToggleSelect, onViewPhotos, onView, onAction, onEdit, onDelete, onUpdateField, cancelMode, onReturn, onUndo, agencyOptions, agencyPhones, countryOptions, compact, narrativeSuggestions, meetsCvReq,
}: {
  candidate: Candidate;
  selected: boolean;
  visibleCols: readonly string[];
  cancelMode?: boolean;
  compact?: boolean;
  meetsCvReq?: boolean;
  onToggleSelect: () => void;
  onViewPhotos: () => void;
  onView: () => void;
  onAction: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateField: (field: EditableField, value: string | null) => void;
  onReturn?: () => void;
  onUndo?: () => void;
  agencyOptions: string[];
  agencyPhones: Record<string, string>;
  countryOptions: string[];
  narrativeSuggestions?: string[];
}) {
  const { user } = useAuth();
  const qcCard = useQueryClient();
  const checkWafidFn = useServerFn(checkWafidMedical);
  const [wafidChecking, setWafidChecking] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [deleteRequestOpen, setDeleteRequestOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [medDateOpen, setMedDateOpen] = useState(false);
  const [pendingMedDate, setPendingMedDate] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ticketFilesOpen, setTicketFilesOpen] = useState(false);
  const [cocEditOpen, setCocEditOpen] = useState(false);
  const [cocEditName, setCocEditName] = useState("");
  const [cocEditPhone, setCocEditPhone] = useState("");
  const statusKey = (["available","processing","arrived","canceled","returned"].includes(candidate.status ?? "")
    ? candidate.status : "available") as Status;
  const deletePending = !!(candidate as any).delete_reason;

  type FieldDef =
    | { label: string; value: string; bold?: boolean; copy?: boolean }
    | { label: string; value: string; edit: "text"; field: EditableField; long?: boolean }
    | { label: string; value: string; edit: "date"; field: EditableField; display?: string; showDays?: boolean }
    | { label: string; value: string; edit: "select"; field: EditableField; options: string[] };

  const allFields: FieldDef[] = [
    { label: "FULL NAME", value: candidate.full_name, bold: true },
    { label: "ADDED BY", value: candidate.created_by_user_id === user?.id ? "You" : (firstName(candidate.created_by_name) || "—") },
    { label: "CANDIDATE CODE", value: candidate.candidate_code ?? "—" },
    { label: "GENDER", value: candidate.gender ?? "—" },
    { label: "AGE", value: String(calcAge(candidate.dob) ?? candidate.age ?? "—") },
    { label: "RELIGION", value: candidate.religion ?? "—" },
    { label: "MARITAL STATUS", value: candidate.marital_status ?? "—" },
    { label: "BIRTH PLACE", value: candidate.birth_place ?? "—" },
    { label: "LIVING TOWN", value: candidate.living_town ?? "", edit: "text", field: "living_town" },
    { label: "PASSPORT NUMBER", value: candidate.passport_number ?? "—", copy: true },
    { label: "LABOUR ID", value: candidate.labour_id ?? "—", copy: true },
    { label: "OFFICE", value: candidate.office ?? "", edit: "select", field: "office", options: OFFICE_OPTIONS },
    { label: "PASSPORT STATUS", value: candidate.passport_status ?? "", edit: "select", field: "passport_status", options: PASSPORT_OPTIONS },
    { label: "COC STATUS", value: candidate.coc_status ?? "", edit: "select", field: "coc_status", options: COC_OPTIONS },
    { label: "COUNTRY", value: candidate.musaned_status ?? "", edit: "select", field: "musaned_status", options: countryOptions },
    { label: "MEDICAL STATUS", value: candidate.medical_status ?? "", edit: "select", field: "medical_status", options: MEDICAL_OPTIONS },
    { label: "MEDICAL DATE", value: candidate.medical_date ?? "", edit: "date", field: "medical_date", display: candidate.medical_date && candidate.medical_status === "Fit" ? `${Math.max(1, Math.floor((Date.now() - new Date(candidate.medical_date + "T00:00:00").getTime()) / 86400000))} days ago` : undefined },
    { label: "EXPERIENCE", value: (candidate.experience === "None" ? "No" : candidate.experience) ?? "—" },
    ...(candidate.experience === "Yes" ? (() => {
      const countries = (candidate.experience_country ?? "").split("|").filter(Boolean);
      const years = (candidate.experience_years ?? "").split("|");
      if (countries.length <= 1) {
        return [
          { label: "EXPERIENCE COUNTRY", value: candidate.experience_country ?? "—" },
          { label: "EXPERIENCE YEARS", value: candidate.experience_years ?? "—" },
        ];
      }
      return countries.map((c, i) => ({
        label: `EXPERIENCE ${i + 1}`,
        value: `${c}${years[i] ? ` · ${years[i]} yr${years[i] === "1" ? "" : "s"}` : ""}`,
      }));
    })() : []),
    { label: "AVAILABILITY", value: (() => { const v = candidate.availability_type ?? "available"; return v.charAt(0).toUpperCase() + v.slice(1); })(), edit: "select", field: "availability_type", options: ["Available", "Private", "Unavailable"] },

    { label: "SELECTED BY", value: candidate.selected_by ?? "", edit: "select", field: "selected_by", options: agencyOptions },
    { label: "CONTRACT DATE", value: candidate.contract_date ?? "", edit: "date", field: "contract_date", showDays: true },
    { label: "CV SENT TO", value: agencyOptions.includes(candidate.cv_sent_to ?? "") ? candidate.cv_sent_to ?? "" : "", edit: "select" as const, field: "cv_sent_to" as const, options: agencyOptions },
    { label: "CV SENT DATE", value: agencyOptions.includes(candidate.cv_sent_to ?? "") && candidate.cv_sent_date ? new Date(candidate.cv_sent_date).toLocaleDateString() : "—" },
    { label: "NARRATIVE", value: candidate.narrative ?? "", edit: "text", field: "narrative", long: true },
    { label: "NARRATIVE PHONE", value: candidate.narrative_phone ?? "", edit: "text", field: "narrative_phone" },
    { label: "NOTES", value: candidate.notes ?? "", edit: "text", field: "notes", long: true },
  ];

  return (
    <>
      <div
        className={cn("border border-border shadow-sm rounded-sm transition-colors", selected && "ring-1 ring-primary/50")}
        style={{ background: selected ? "var(--selected-bg)" : "var(--card)" }}
      >
        <div className="sticky left-0 z-10 w-fit flex items-center gap-2 px-4 pt-2.5 pb-1" style={{ background: selected ? "var(--selected-bg)" : "var(--card)" }}>
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label="Select candidate" disabled={candidate.visa_status === "Waiting Replacement"} />
          <StatusBadge status={candidate.status ?? "available"} />
          {candidate.availability_type?.toLowerCase() === "private" && (
            <span className="inline-flex items-center rounded-sm bg-purple-400 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 text-[10px] font-semibold px-1.5 py-0.5 leading-none">
              Private
            </span>
          )}
          {candidate.availability_type?.toLowerCase() === "unavailable" && (
            <span className="inline-flex items-center rounded-sm bg-red-400 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[10px] font-semibold px-1.5 py-0.5 leading-none">
              Unavailable
            </span>
          )}
          {meetsCvReq && (
            <span className="inline-flex items-center gap-0.5 rounded-sm bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-semibold px-1.5 py-0.5 leading-none">
              ✓ CV Ready
            </span>
          )}
          {candidate.medical_status && (
            <span className={cn(
              "inline-flex items-center gap-0.5 rounded-sm text-[10px] font-semibold px-1.5 py-0.5 leading-none",
              candidate.medical_status === "Fit"         && "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
              candidate.medical_status === "Unfit"       && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
              candidate.medical_status === "Expired"     && "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
              candidate.medical_status === "Booked"      && "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
              candidate.medical_status === "In progress" && "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
              candidate.medical_status === "No"          && "bg-muted text-muted-foreground",
            )}>
              <Stethoscope className="h-2.5 w-2.5" />
              {candidate.medical_status}
            </span>
          )}
        </div>
        <div className="flex items-center pb-3 pt-1">
          <div className="sticky left-0 z-10 shrink-0 self-stretch flex items-center gap-4 pl-4 pr-3" style={{ background: selected ? "var(--selected-bg)" : "var(--card)" }}>
            <button type="button" onClick={onViewPhotos} className="shrink-0">
              <Avatar className={cn("hover:ring-2 hover:ring-primary transition-all", compact ? "h-10 w-10" : "h-14 w-14")}>
                {candidate.photo_url && <AvatarImage src={candidate.photo_url} alt={candidate.full_name} />}
                <AvatarFallback className="text-[11px]">{candidate.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </button>
            <div className="shrink-0 w-[110px]">
              <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1 whitespace-nowrap">FULL NAME</div>
              <button type="button" onClick={onView} className={cn("text-sm font-semibold text-left hover:text-primary hover:underline transition-colors break-words", compact ? "line-clamp-1" : "line-clamp-2")}>
                {candidate.full_name || "—"}
              </button>
            </div>
          </div>
          <div className={cn("flex-1 flex items-start gap-2", candidate.visa_status === "Waiting Replacement" && "pointer-events-none opacity-60")}>
            {visibleCols.map((colLabel) => {
              if (colLabel === "FULL NAME") return null;
              if (colLabel === "VIDEO") {
                return (
                  <div key="VIDEO" className="shrink-0 w-[110px]">
                    <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1 whitespace-nowrap">VIDEO</div>
                    <VideoCell url={candidate.video_url ?? null} onSave={(v) => onUpdateField("video_url", v)} candidateName={candidate.full_name} />
                  </div>
                );
              }
              if (colLabel === "TICKET PDF") {
                const ca = candidate as any;
                const isReturned = candidate.status === "returned";
                const ticketItems: React.ReactNode[] = [];
                if (ca.ticket_pdf_url) ticketItems.push(
                  <div key="ticket" className="flex items-center gap-1">
                    <button type="button" onClick={() => setTicketFilesOpen(true)} className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 hover:underline shrink-0">PDF</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.ticket_pdf_url); }} className="text-blue-700 dark:text-blue-400 hover:opacity-70"><Download className="h-3 w-3" /></button>
                  </div>
                );
                if (ca.qr_url) ticketItems.push(
                  <div key="qr" className="flex items-center gap-1">
                    <button type="button" onClick={() => setTicketFilesOpen(true)} className="text-[10px] font-semibold text-green-700 dark:text-green-400 hover:underline shrink-0">QR</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.qr_url); }} className="text-green-700 dark:text-green-400 hover:opacity-70"><Download className="h-3 w-3" /></button>
                  </div>
                );
                if (ca.visa_pdf_url) ticketItems.push(
                  <div key="visa" className="flex items-center gap-1">
                    <button type="button" onClick={() => setTicketFilesOpen(true)} className="text-[10px] font-semibold text-purple-700 dark:text-purple-400 hover:underline shrink-0">VISA</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.visa_pdf_url); }} className="text-purple-700 dark:text-purple-400 hover:opacity-70"><Download className="h-3 w-3" /></button>
                  </div>
                );
                if (isReturned && ca.return_ticket_url) ticketItems.push(
                  <div key="return" className="flex items-center gap-1">
                    <button type="button" onClick={() => setTicketFilesOpen(true)} className="text-[10px] font-semibold text-orange-700 dark:text-orange-400 hover:underline shrink-0">RTN</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.return_ticket_url); }} className="text-orange-700 dark:text-orange-400 hover:opacity-70"><Download className="h-3 w-3" /></button>
                  </div>
                );
                if (isReturned && ca.stamp_url) ticketItems.push(
                  <div key="stamp" className="flex items-center gap-1">
                    <button type="button" onClick={() => setTicketFilesOpen(true)} className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 hover:underline shrink-0">STAMP</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.stamp_url); }} className="text-rose-700 dark:text-rose-400 hover:opacity-70"><Download className="h-3 w-3" /></button>
                  </div>
                );
                return (
                  <div key="TICKET PDF" className="shrink-0">
                    <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1 whitespace-nowrap">TICKET FILES</div>
                    <div className="flex flex-col gap-0.5">
                      {ticketItems.length > 0
                        ? ticketItems
                        : <button type="button" onClick={() => setTicketFilesOpen(true)} className="text-muted-foreground text-sm">—</button>}
                    </div>
                  </div>
                );
              }
              const f = allFields.find((f) => f.label === colLabel);
              if (!f) return null;
              return (
                <div key={colLabel} className="shrink-0 w-[110px]">
                  <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1">{colLabel}</div>
                  <div className="text-sm text-foreground break-words">
                    {"edit" in f && f.edit === "text" ? (
                      <InlineText value={f.value} onSave={(v) => onUpdateField(f.field, v)} suggestions={f.field === "narrative" ? narrativeSuggestions : undefined} />
                    ) : "edit" in f && f.edit === "date" ? (
                      <InlineDate value={f.value} display={f.display} showDays={"showDays" in f ? f.showDays : undefined} onSave={(v) => onUpdateField(f.field, v)} />
                    ) : "edit" in f && f.edit === "select" ? (
                      colLabel === "COC STATUS" && f.value === "Placed" ? (
                        <div className="flex items-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <InlineSelect value={f.value} options={f.options} onSave={(v) => onUpdateField(f.field, v)} />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="rounded-none text-xs p-2 space-y-0.5">
                                <div className="font-semibold">{(candidate as any).coc_agency_name || "—"}</div>
                                <div>{(candidate as any).coc_agency_phone || "No phone"}</div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setCocEditName((candidate as any).coc_agency_name ?? ""); setCocEditPhone((candidate as any).coc_agency_phone ?? ""); setCocEditOpen(true); }}>
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      ) : colLabel === "MEDICAL STATUS" ? (
                        <div className="flex items-center gap-1 min-w-0">
                          <InlineSelect value={f.value} options={f.options} onSave={(v) => {
                            if (v === "Fit" && !candidate.medical_date) {
                              setPendingMedDate(""); setMedDateOpen(true);
                            } else if (v === "Fit" && candidate.medical_date && medDaysAgo(candidate.medical_date) >= 90) {
                              toast.error("Medical date is over 90 days ago — status set to Expired");
                              onUpdateField(f.field, "Expired");
                            } else {
                              onUpdateField(f.field, v);
                            }
                          }} />
                          {candidate.passport_number && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    disabled={wafidChecking}
                                    className="shrink-0 text-muted-foreground hover:text-teal-600 disabled:opacity-40 transition-colors"
                                    onClick={async () => {
                                      setWafidChecking(true);
                                      const tid = toast.loading("Connecting to wafid.com…");
                                      try {
                                        const res = await checkWafidFn({ data: { candidateId: candidate.id } });
                                        if (res.status) {
                                          toast.success(`wafid.com · ${res.message}`, { id: tid });
                                          qcCard.invalidateQueries({ queryKey: ["manager-candidates"] });
                                        } else {
                                          toast.info(`wafid.com · ${res.message}`, { id: tid });
                                        }
                                      } catch (e) {
                                        toast.error(`wafid.com · ${String(e)}`, { id: tid });
                                      } finally {
                                        setWafidChecking(false);
                                      }
                                    }}
                                  >
                                    {wafidChecking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="rounded-none text-xs p-2">
                                  {wafidChecking ? "Connecting to wafid.com…" : "Check on wafid.com"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      ) : colLabel === "CV SENT TO" && (() => {
                          const ra = (candidate as any).reserved_at;
                          return ra && (Date.now() - new Date(ra).getTime()) < 3 * 86_400_000;
                        })() ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium cursor-default">
                                <Lock className="h-3 w-3" />
                                Reserved — {3 - Math.floor((Date.now() - new Date((candidate as any).reserved_at).getTime()) / 86_400_000)}d left
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="rounded-none text-xs p-2">
                              Reserved by <strong>{(candidate as any).reserved_by ?? "agency"}</strong>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <InlineSelect value={f.value} options={f.options} onSave={(v) => onUpdateField(f.field, v)} />
                      )
                    ) : "copy" in f && f.copy && f.value && f.value !== "—" ? (
                      <button
                        type="button"
                        title="Click to copy"
                        onClick={() => { navigator.clipboard.writeText(f.value); toast.success("Copied!"); }}
                        className={cn("text-left break-words hover:text-primary hover:underline cursor-copy transition-colors", compact ? "line-clamp-1" : "line-clamp-2")}
                      >
                        {f.value}
                      </button>
                    ) : (
                      <span className={cn("break-words", compact ? "line-clamp-1" : "line-clamp-2")}>{f.value || "—"}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="sticky right-0 z-10 shrink-0 self-stretch flex flex-col items-center justify-center gap-1.5 px-4 border-l border-border" style={{ background: selected ? "var(--selected-bg)" : "var(--card)" }}>
            <Button size="sm" onClick={() => setViewing(true)} className="w-full px-5 h-8 rounded text-xs font-semibold tracking-wide">
              VIEW
            </Button>
            {candidate.visa_status === "Waiting Replacement" ? (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">🔒 Locked</span>
            ) : (
              <button onClick={onEdit} className="text-xs text-primary hover:underline">Edit</button>
            )}
            <button
              onClick={() => setHistoryOpen(true)}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1"
              title="View update history"
            >
              <History className="h-3 w-3" /> History
            </button>
            {onReturn && (
              <button onClick={() => setReturnOpen(true)} className="text-xs text-orange-600 hover:underline">Return</button>
            )}
            {onUndo && (
              <button onClick={onUndo} className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
                <Undo2 className="h-3 w-3" /> Undo
              </button>
            )}
            <button
              onClick={() => setDeleteRequestOpen(true)}
              className="text-xs text-destructive hover:underline"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
      {deleteRequestOpen && (
        <CancelReasonDialog
          onConfirm={(reason) => { onUpdateField("notes", reason); onDelete(); setDeleteRequestOpen(false); }}
          onClose={() => setDeleteRequestOpen(false)}
        />
      )}
      {returnOpen && onReturn && (
        <ReturnReasonDialog
          onConfirm={(reason) => { onUpdateField("notes", reason); onReturn(); setReturnOpen(false); }}
          onClose={() => setReturnOpen(false)}
        />
      )}
      <CandidateHistoryDialog
        candidateId={candidate.id}
        candidateName={candidate.full_name}
        createdAt={candidate.created_at}
        createdByName={candidate.created_by_name}
        createdByUserId={candidate.created_by_user_id}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
      {ticketFilesOpen && (
        <TicketFilesDialog
          candidate={candidate}
          onUpdateField={(field, value) => onUpdateField(field as EditableField, value)}
          onClose={() => setTicketFilesOpen(false)}
          showReturnFiles={candidate.status === "returned"}
        />
      )}
      {medDateOpen && (
        <Dialog open onOpenChange={(o) => { if (!o) setMedDateOpen(false); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Medical Date Required</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Please enter the <strong>Medical Date</strong> before setting Medical Status to <strong>"Fit"</strong>.
            </p>
            <div className="py-2">
              <Input type="date" value={pendingMedDate} onChange={(e) => setPendingMedDate(e.target.value)} className="rounded-none h-9" />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setMedDateOpen(false)}>Cancel</Button>
              <Button disabled={!pendingMedDate} onClick={() => {
                if (!pendingMedDate) return;
                const status = medDaysAgo(pendingMedDate) >= 90 ? "Expired" : "Fit";
                if (status === "Expired") toast.error("Medical date is over 90 days ago — status set to Expired");
                onUpdateField("medical_date", pendingMedDate);
                onUpdateField("medical_status", status);
                setMedDateOpen(false);
              }}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {cocEditOpen && (
        <Dialog open onOpenChange={(o) => { if (!o) setCocEditOpen(false); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Edit COC Agency Details</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <Input placeholder="Agency Name" value={cocEditName} onChange={(e) => setCocEditName(e.target.value)} className="rounded-none h-9" />
              <Input placeholder="Phone Number" value={cocEditPhone} onChange={(e) => setCocEditPhone(e.target.value)} className="rounded-none h-9" />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCocEditOpen(false)}>Cancel</Button>
              <Button disabled={!cocEditName.trim() || !cocEditPhone.trim()} onClick={() => { onUpdateField("coc_agency_name", cocEditName.trim()); onUpdateField("coc_agency_phone", cocEditPhone.trim()); setCocEditOpen(false); }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <CandidateDetailDialog
        candidate={viewing ? candidate : null}
        onClose={() => setViewing(false)}
        agencyPhones={agencyPhones}
      />
    </>
  );
}
