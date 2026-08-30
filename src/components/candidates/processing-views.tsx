import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { checkWafidMedical } from "@/lib/candidates.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Loader2, History, Download, Globe, ArrowUpDown, RotateCcw, SlidersHorizontal, Search, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "sonner";
import {
  MEDICAL_OPTIONS, COC_OPTIONS, TASHEER_OPTIONS, WOKALA_OPTIONS, VISA_OPTIONS,
  INSURANCE_OPTIONS, LMIS_OPTIONS, UNFILLED_LMIS_OPTIONS, TICKET_OPTIONS,
  ARRIVAL_CITY_OPTIONS, medDaysAgo, PROCESSING_COLS,
} from "./types";
import type { Candidate, ProcessingColDef } from "./types";
import { FilterSelect, MultiFilterSelect, InlineDate, InlineText, InlineSelect } from "./atoms";
import { LmisFilesDialog, TicketFilesDialog, downloadFile } from "./forms";
import { CandidatePhotosDialog, ArrivedCheckDialog, DeleteReasonDialog, CandidateDetailDialog } from "./dialogs";
import { CandidateHistoryDialog } from "./candidate-views";

const INITIAL_PROC_FILTERS = {
  sort:             "newest",
  narrative:        [] as string[],
  medical_status:   [] as string[],
  coc_status:       [] as string[],
  tasheer_status:   [] as string[],
  wokala_status:    [] as string[],
  visa_status:      [] as string[],
  insurance_status: [] as string[],
  unfilled_lmis:    [] as string[],
  lmis_status:      [] as string[],
  ticket_status:    [] as string[],
  arrival_city:     [] as string[],
  selected_by:      [] as string[],
};

export function ProcessingTable({
  candidates, selected, onToggleSelect, onAction, onUpdateField, onEdit, onDelete, cancelMode,
  countryMeta, officesByCountry, agencyPhones, agencyOptions, pageKey,
}: {
  candidates: Candidate[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onAction: (c: Candidate) => void;
  onUpdateField: (id: string, field: string, value: string | null) => void;
  onEdit: (c: Candidate) => void;
  onDelete: (id: string) => void;
  cancelMode?: boolean;
  countryMeta: Array<{ name: string; flag: string }>;
  officesByCountry: Record<string, string[]>;
  agencyPhones: Record<string, string>;
  agencyOptions: string[];
  pageKey: string;
}) {
  const [viewingPhotos, setViewingPhotos] = useState<Candidate | null>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    try {
      const s = sessionStorage.getItem("mgr-hidden-cols-proc-v3");
      if (s) return new Set(JSON.parse(s));
    } catch {}
    return new Set(["destination_country", "office"]);
  });
  useEffect(() => {
    sessionStorage.setItem("mgr-hidden-cols-proc-v3", JSON.stringify(Array.from(hiddenCols)));
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
  const [search, setSearch] = useState(() => {
    try { return sessionStorage.getItem(`mgr-proc-search-${pageKey}`) || ""; } catch { return ""; }
  });
  const [procFilters, setProcFilters] = useState<typeof INITIAL_PROC_FILTERS>(() => {
    try {
      const s = sessionStorage.getItem(`mgr-proc-filters-${pageKey}`);
      if (s) return { ...INITIAL_PROC_FILTERS, ...JSON.parse(s) };
    } catch {}
    return INITIAL_PROC_FILTERS;
  });
  const [activeCountryTab, setActiveCountryTab] = useState(() => {
    try { return sessionStorage.getItem(`mgr-proc-country-${pageKey}`) || "all"; } catch { return "all"; }
  });
  const [activeOfficeTab, setActiveOfficeTab] = useState(() => {
    try { return sessionStorage.getItem(`mgr-proc-office-${pageKey}`) || "all"; } catch { return "all"; }
  });
  useEffect(() => { try { sessionStorage.setItem(`mgr-proc-search-${pageKey}`, search); } catch {} }, [search, pageKey]);
  useEffect(() => { try { sessionStorage.setItem(`mgr-proc-filters-${pageKey}`, JSON.stringify(procFilters)); } catch {} }, [procFilters, pageKey]);
  useEffect(() => { try { sessionStorage.setItem(`mgr-proc-country-${pageKey}`, activeCountryTab); } catch {} }, [activeCountryTab, pageKey]);
  useEffect(() => { try { sessionStorage.setItem(`mgr-proc-office-${pageKey}`, activeOfficeTab); } catch {} }, [activeOfficeTab, pageKey]);
  const f = procFilters;
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
  const allCols = useMemo((): ProcessingColDef[] => {
    const countryNames = countryMeta.map((c) => c.name);
    return [
      ...(countryNames.length > 0 ? [
        { key: "destination_country", header: "Country", type: "select" as const, options: countryNames },
        { key: "office", header: "Office", type: "select-dynamic" as const },
      ] : []),
      ...PROCESSING_COLS,
    ];
  }, [countryMeta]);

  const activeCount = Object.entries(procFilters).filter(([k, v]) =>
    k !== "sort" && (Array.isArray(v) ? v.length > 0 : v !== "all")
  ).length;

  const narrativeOpts = useMemo(() =>
    Array.from(new Set(candidates.map((c) => (c.narrative as string | null) ?? "").filter(Boolean))).sort(),
  [candidates]);

  const matchesCountry = (c: Candidate, country: string) =>
    c.destination_country === country || c.musaned_status === country;

  const filteredCandidates = useMemo(() => {
    let list = candidates;
    if (activeCountryTab !== "all") list = list.filter((c) => matchesCountry(c, activeCountryTab));
    if (activeOfficeTab !== "all") list = list.filter((c) => c.office === activeOfficeTab);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.full_name.toLowerCase().includes(q) ||
        (c.passport_number ?? "").toLowerCase().includes(q) ||
        (c.serial_number ?? "").toLowerCase().includes(q)
      );
    }
    if (f.narrative.length > 0)        list = list.filter((c) => f.narrative.includes(c.narrative ?? ""));
    if (f.medical_status.length > 0)   list = list.filter((c) => f.medical_status.includes(c.medical_status ?? ""));
    if (f.coc_status.length > 0)       list = list.filter((c) => f.coc_status.includes(c.coc_status ?? ""));
    if (f.tasheer_status.length > 0)   list = list.filter((c) => f.tasheer_status.includes(c.tasheer_status ?? ""));
    if (f.wokala_status.length > 0)    list = list.filter((c) => f.wokala_status.includes(c.wokala_status ?? ""));
    if (f.visa_status.length > 0)      list = list.filter((c) => f.visa_status.includes(c.visa_status ?? ""));
    if (f.insurance_status.length > 0) list = list.filter((c) => f.insurance_status.includes(c.insurance_status ?? ""));
    if (f.unfilled_lmis.length > 0) {
      list = list.filter((c) => {
        const ca = c as any;
        return f.unfilled_lmis.every((opt) => {
          if (opt === "INSU") return !ca.lmis_insu_url;
          if (opt === "COC")  return !ca.lmis_coc_url;
          if (opt === "ID")   return !ca.lmis_id_url && !ca.lmis_id_relative_url;
          return true;
        });
      });
    }
    if (f.lmis_status.length > 0)      list = list.filter((c) => f.lmis_status.includes(c.lmis_status ?? ""));
    if (f.ticket_status.length > 0)    list = list.filter((c) => f.ticket_status.includes(c.ticket_status ?? ""));
    if (f.arrival_city.length > 0)     list = list.filter((c) => f.arrival_city.includes(c.arrival_city ?? ""));
    if (f.selected_by.length > 0)      list = list.filter((c) => f.selected_by.includes(c.selected_by ?? ""));
    return [...list].sort((a, b) => {
      const ad = a.contract_date ?? "";
      const bd = b.contract_date ?? "";
      const byCd = f.sort === "oldest" ? ad.localeCompare(bd) : bd.localeCompare(ad);
      if (byCd !== 0) return byCd;
      const byCreated = f.sort === "oldest"
        ? a.created_at.localeCompare(b.created_at)
        : b.created_at.localeCompare(a.created_at);
      return byCreated !== 0 ? byCreated : a.id.localeCompare(b.id);
    });
  }, [candidates, activeCountryTab, activeOfficeTab, search, f.sort, f.narrative, f.medical_status, f.coc_status, f.tasheer_status, f.wokala_status,
      f.visa_status, f.insurance_status, f.unfilled_lmis, f.lmis_status,
      f.ticket_status, f.arrival_city, f.selected_by]);

  const [page, setPage] = useState(() => {
    try { return Math.max(1, parseInt(sessionStorage.getItem(`mgr-proc-page-${pageKey}`) || "1", 10)); } catch { return 1; }
  });
  const [pageSize, setPageSize] = useState(() => {
    try { return parseInt(sessionStorage.getItem(`mgr-proc-pgsz-${pageKey}`) || "5", 10) || 5; } catch { return 5; }
  });
  useEffect(() => { try { sessionStorage.setItem(`mgr-proc-page-${pageKey}`, String(page)); } catch {} }, [page, pageKey]);
  useEffect(() => { try { sessionStorage.setItem(`mgr-proc-pgsz-${pageKey}`, String(pageSize)); } catch {} }, [pageSize, pageKey]);
  const firstMountProcRef = useRef(true);
  useEffect(() => {
    if (firstMountProcRef.current) { firstMountProcRef.current = false; return; }
    setPage(1);
  }, [filteredCandidates.length, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / pageSize));
  const paginated = filteredCandidates.slice((page - 1) * pageSize, page * pageSize);
  const visibleCols = allCols.filter((col) => !hiddenCols.has(col.key));
  const allSel = paginated.length > 0 && paginated.every((c) => selected.has(c.id));
  const someSel = !allSel && paginated.some((c) => selected.has(c.id));

  const arrivedChecked = useRef<Set<string>>(new Set());
  const [arrivedCheckCandidate, setArrivedCheckCandidate] = useState<Candidate | null>(null);

  useEffect(() => {
    for (const c of candidates) {
      if (c.medical_status === "Fit" && c.medical_date && medDaysAgo(c.medical_date) >= 90) {
        onUpdateField(c.id, "medical_status", "Expired");
      }
    }
  }, [candidates]);

  useEffect(() => {
    if (arrivedCheckCandidate) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const c of candidates) {
      if (arrivedChecked.current.has(c.id)) continue;
      if (c.ticket_status === "Booked" && c.ticket_date && c.status === "processing") {
        const ticketDate = new Date(c.ticket_date + "T00:00:00");
        if (today > ticketDate) {
          arrivedChecked.current.add(c.id);
          setArrivedCheckCandidate(c);
          return;
        }
      }
    }
  }, [candidates, arrivedCheckCandidate]);

  const setMulti = (key: keyof typeof INITIAL_PROC_FILTERS) => (v: string[]) =>
    setProcFilters((p) => ({ ...p, [key]: v }));

  return (
    <div className="space-y-2">
      {<Card className="rounded-none">
        <CardContent className="p-3">
          <div className="flex items-center gap-1.5">
            {activeCount > 0 && (
              <span className="rounded-none bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">{activeCount}</span>
            )}
          </div>
            <div className="mt-3 flex flex-wrap gap-5">
              <FilterSelect value={f.sort} onChange={(v) => setProcFilters((p) => ({ ...p, sort: v }))}
                icon={ArrowUpDown}
                options={[{ value: "newest", label: "Date (Newest)" }, { value: "oldest", label: "Date (Oldest)" }]} />
              <MultiFilterSelect placeholder="Narrative" values={f.narrative} onChange={setMulti("narrative")} options={[{ value: "", label: "Not Selected" }, ...narrativeOpts.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect placeholder="Medical" values={f.medical_status} onChange={setMulti("medical_status")} options={[{ value: "", label: "Not Selected" }, ...MEDICAL_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect placeholder="COC" values={f.coc_status} onChange={setMulti("coc_status")} options={[{ value: "", label: "Not Selected" }, ...COC_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect placeholder="Tasheer" values={f.tasheer_status} onChange={setMulti("tasheer_status")} options={[{ value: "", label: "Not Selected" }, ...TASHEER_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect placeholder="Wokala" values={f.wokala_status} onChange={setMulti("wokala_status")} options={[{ value: "", label: "Not Selected" }, ...WOKALA_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect placeholder="Visa" values={f.visa_status} onChange={setMulti("visa_status")} options={[{ value: "", label: "Not Selected" }, ...VISA_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect placeholder="Insurance" values={f.insurance_status} onChange={setMulti("insurance_status")} options={[{ value: "", label: "Not Selected" }, ...INSURANCE_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect placeholder="LMIS file" values={f.unfilled_lmis} onChange={setMulti("unfilled_lmis")} options={UNFILLED_LMIS_OPTIONS.map((o) => ({ value: o, label: o }))} />
              <MultiFilterSelect placeholder="LMIS" values={f.lmis_status} onChange={setMulti("lmis_status")} options={[{ value: "", label: "Not Selected" }, ...LMIS_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect placeholder="Ticket" values={f.ticket_status} onChange={setMulti("ticket_status")} options={[{ value: "", label: "Not Selected" }, ...TICKET_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect placeholder="Arrival City" values={f.arrival_city} onChange={setMulti("arrival_city")} options={[{ value: "", label: "Not Selected" }, ...ARRIVAL_CITY_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect placeholder="Selected By" values={f.selected_by} onChange={setMulti("selected_by")} options={[{ value: "", label: "Not Selected" }, ...agencyOptions.map((o) => ({ value: o, label: o }))]} />
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-7 text-xs rounded-none w-52"
                  placeholder="Search name / passport…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{filteredCandidates.length}</span> candidate{filteredCandidates.length !== 1 ? "s" : ""} found</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs font-bold text-black"
                onClick={() => { setProcFilters(INITIAL_PROC_FILTERS); setSearch(""); }}
                disabled={activeCount === 0 && !search}>
                <RotateCcw className="h-3 w-3" /> Reset
              </Button>
              <div className="relative" ref={colPickerRef}>
                <Button size="sm" variant="outline" className="h-6 gap-1.5 text-xs"
                  onClick={() => setShowColPicker((v) => !v)}>
                  <SlidersHorizontal className="h-3 w-3" /> Columns
                  {hiddenCols.size > 0 && (
                    <span className="ml-1 rounded-none bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">{hiddenCols.size} hidden</span>
                  )}
                </Button>
                {showColPicker && (
                  <div className="absolute right-0 bottom-7 z-50 bg-popover border border-border rounded-none shadow-xl p-3 w-[340px]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Columns</span>
                      <button type="button" onClick={() => setHiddenCols(new Set())}
                        className="text-[11px] text-primary hover:underline disabled:opacity-40"
                        disabled={hiddenCols.size === 0}>
                        Reset
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {allCols.map((col) => (
                        <label key={col.key} className="flex items-center gap-1.5 text-xs cursor-pointer py-1 hover:text-primary">
                          <Checkbox checked={!hiddenCols.has(col.key)}
                            onCheckedChange={(v) =>
                              setHiddenCols((prev) => { const n = new Set(prev); v ? n.delete(col.key) : n.add(col.key); return n; })
                            } />
                          {col.header}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>}

      {selected.size === 0 && countryMeta.length > 0 && (
        <Card className="rounded-none">
          <CardContent className="px-3 py-2">
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => { setActiveCountryTab("all"); setActiveOfficeTab("all"); }}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-none border transition-colors",
                  activeCountryTab === "all"
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40",
                )}
              >
                All ({candidates.length})
              </button>
              {countryMeta.map((c) => {
                const count = candidates.filter((cand) => matchesCountry(cand, c.name)).length;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      const next = activeCountryTab === c.name ? "all" : c.name;
                      setActiveCountryTab(next);
                      setActiveOfficeTab("all");
                    }}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-none border transition-colors flex items-center gap-1.5",
                      activeCountryTab === c.name
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40",
                    )}
                  >
                    <span>{c.flag}</span>
                    {c.name}
                    <span className="opacity-60">({count})</span>
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
              <button
                type="button"
                onClick={() => setActiveOfficeTab("all")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-none border transition-colors",
                  activeOfficeTab === "all"
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40",
                )}
              >
                All offices
              </button>
              {(officesByCountry[activeCountryTab] ?? []).map((office) => {
                const count = candidates.filter((c) => matchesCountry(c, activeCountryTab) && c.office === office).length;
                return (
                  <button
                    key={office}
                    type="button"
                    onClick={() => setActiveOfficeTab(activeOfficeTab === office ? "all" : office)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-none border transition-colors flex items-center gap-1.5",
                      activeOfficeTab === office
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40",
                    )}
                  >
                    {office}
                    <span className="opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {filteredCandidates.length > 0 && (
        <div className="flex items-center px-1">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <Checkbox
              checked={allSel ? true : someSel ? "indeterminate" : false}
              onCheckedChange={(v) =>
                paginated.forEach((c) => { if (!!v !== selected.has(c.id)) onToggleSelect(c.id); })
              }
            />
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </label>
        </div>
      )}

      {candidates.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">No candidates in processing.</CardContent></Card>
      ) : filteredCandidates.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No matches for the selected filters.</CardContent></Card>
      ) : (
        <div className="relative">
          <div ref={scrollRef} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-2 min-w-max">
              {paginated.map((c) => (
                <ProcessingCard
                  key={c.id}
                  candidate={c}
                  selected={selected.has(c.id)}
                  visibleCols={visibleCols}
                  cancelMode={cancelMode}
                  onToggleSelect={() => onToggleSelect(c.id)}
                  onViewPhotos={() => setViewingPhotos(c)}
                  onAction={() => onAction(c)}
                  onUpdateField={(field, value) => onUpdateField(c.id, field, value)}
                  onEdit={() => onEdit(c)}
                  onDelete={() => onDelete(c.id)}
                  officesByCountry={officesByCountry}
                  agencyPhones={agencyPhones}
                  narrativeSuggestions={narrativeOpts}
                />
              ))}
            </div>
          </div>
          <div ref={fadeRef} aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent opacity-0 transition-opacity duration-200" />
        </div>
      )}
      <CandidatePhotosDialog candidate={viewingPhotos} onClose={() => setViewingPhotos(null)} />
      {arrivedCheckCandidate && (
        <ArrivedCheckDialog
          candidate={arrivedCheckCandidate}
          onArrived={() => {
            onUpdateField(arrivedCheckCandidate.id, "status", "arrived");
            setArrivedCheckCandidate(null);
          }}
          onNotArrived={(reason, problem) => {
            const note = `[${new Date().toLocaleDateString()}] Not arrived — ${reason}: ${problem}`;
            const existing = arrivedCheckCandidate.processing_notes ?? "";
            onUpdateField(arrivedCheckCandidate.id, "processing_notes", existing ? `${existing}\n${note}` : note);
            setArrivedCheckCandidate(null);
          }}
          onClose={() => setArrivedCheckCandidate(null)}
        />
      )}

      {candidates.length > 0 && (
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
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredCandidates.length)} of {filteredCandidates.length}
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

function ProcessingCard({
  candidate, selected, visibleCols, onToggleSelect, onViewPhotos, onAction, onUpdateField, onEdit, onDelete, cancelMode,
  officesByCountry, agencyPhones, narrativeSuggestions,
}: {
  candidate: Candidate;
  selected: boolean;
  visibleCols: ProcessingColDef[];
  cancelMode?: boolean;
  onToggleSelect: () => void;
  onViewPhotos: () => void;
  onAction: () => void;
  onUpdateField: (field: string, value: string | null) => void;
  onEdit: () => void;
  onDelete: () => void;
  officesByCountry: Record<string, string[]>;
  agencyPhones: Record<string, string>;
  narrativeSuggestions?: string[];
}) {
  const [viewing, setViewing] = useState(false);
  const [requireDate, setRequireDate] = useState<{
    field: "ticket_date" | "tasheer_date" | "medical_date" | "insurance_date";
    label: string;
    pendingStatus: string;
    statusField: string;
  } | null>(null);
  const [pendingDate, setPendingDate] = useState("");
  const [deleteRequestOpen, setDeleteRequestOpen] = useState(false);
  const [embassyOpen, setEmbassyOpen] = useState(false);
  const [embassyStep, setEmbassyStep] = useState<"ask" | "reason">("ask");
  const [embassyReason, setEmbassyReason] = useState("");
  const [visaReturnOpen, setVisaReturnOpen] = useState(false);
  const [visaReturnReason, setVisaReturnReason] = useState("");
  const [cocPlacedOpen, setCocPlacedOpen] = useState(false);
  const [cocPlacedName, setCocPlacedName] = useState("");
  const [cocPlacedPhone, setCocPlacedPhone] = useState("");
  const [lmisFilesOpen, setLmisFilesOpen] = useState(false);
  const [embassyOverwriteOpen, setEmbassyOverwriteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ticketFilesOpen, setTicketFilesOpen] = useState(false);
  const [ticketHoldOpen, setTicketHoldOpen] = useState(false);
  const [ticketHoldReason, setTicketHoldReason] = useState("");
  const qcProc = useQueryClient();
  const checkWafidProcFn = useServerFn(checkWafidMedical);
  const [wafidProcChecking, setWafidProcChecking] = useState(false);

  function handleColUpdate(colKey: string, value: string | null) {
    if (colKey === "coc_status" && value === "Placed") {
      setCocPlacedOpen(true);
      setCocPlacedName((candidate as any).coc_agency_name ?? "");
      setCocPlacedPhone((candidate as any).coc_agency_phone ?? "");
      return;
    }
    if (colKey === "insurance_status" && value === "Done") {
      setRequireDate({ field: "insurance_date", label: "Insurance Date", pendingStatus: "Done", statusField: "insurance_status" });
      setPendingDate((candidate as any).insurance_date ?? "");
      return;
    }
    if (colKey === "visa_status" && (value === "Ready for embassy" || value === "Returned")) {
      const tasheerDone = candidate.tasheer_status === "Done";
      const passportOk = candidate.passport_accepted === true;
      const wokalaPaid = candidate.wokala_status === "Paid";
      if (candidate.status !== "processing" || !tasheerDone || (!passportOk && !wokalaPaid)) {
        toast.error("Candidate must be Processing with Tasheer = Done and either Passport Accepted or Wokala = Paid");
        return;
      }
    }
    if (colKey === "visa_status" && value === "Returned") {
      setVisaReturnOpen(true); setVisaReturnReason("");
      return;
    }
    if (colKey === "ticket_status" && value === "Hold") {
      setTicketHoldOpen(true);
      setTicketHoldReason("");
      return;
    }
    if (colKey === "ticket_status" && candidate.ticket_status === "Hold" && value !== "Hold") {
      onUpdateField("processing_notes", null);
    }
    if (colKey === "ticket_status" && value === "Booked") {
      setRequireDate({ field: "ticket_date", label: "Ticket Date", pendingStatus: "Booked", statusField: "ticket_status" });
      setPendingDate(candidate.ticket_date ?? "");
      return;
    }
    if (colKey === "tasheer_status" && value === "Booked") {
      setRequireDate({ field: "tasheer_date", label: "Tasheer Date", pendingStatus: "Booked", statusField: "tasheer_status" });
      setPendingDate(candidate.tasheer_date ?? "");
      return;
    }
    if (colKey === "tasheer_status" && value === "Done") {
      setEmbassyOpen(true); setEmbassyStep("ask"); setEmbassyReason("");
      return;
    }
    if (colKey === "medical_status" && value === "Fit") {
      if (!candidate.medical_date) {
        setRequireDate({ field: "medical_date", label: "Medical Date", pendingStatus: "Fit", statusField: "medical_status" });
        setPendingDate("");
        return;
      }
      if (medDaysAgo(candidate.medical_date) >= 90) {
        toast.error("Medical date is over 90 days ago — status set to Expired");
        onUpdateField(colKey, "Expired");
        return;
      }
    }
    onUpdateField(colKey, value);
    if (colKey === "medical_status" && value === "Fit") onUpdateField("lmis_status", "Not tested");
    if (colKey === "visa_status" && !value) onUpdateField("embassy_date", null);
    if (colKey === "visa_status" && value === "Sent to Embassy") {
      if ((candidate as any).embassy_date) {
        setEmbassyOverwriteOpen(true);
      } else {
        onUpdateField("embassy_date", new Date().toISOString().split("T")[0]);
      }
    }
  }

  return (
    <>
      <div
        className={cn("border border-border shadow-sm rounded-sm transition-colors", selected && "ring-1 ring-primary/50")}
        style={{ background: selected ? "var(--selected-bg)" : "var(--card)" }}
      >
        <div className="sticky left-0 z-10 w-fit flex items-center gap-2 px-4 pt-2.5 pb-1" style={{ background: selected ? "var(--selected-bg)" : "var(--card)" }}>
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label="Select candidate" disabled={candidate.visa_status === "Waiting Replacement"} />
          <StatusBadge status="processing" />
        </div>
        <div className="flex items-center pb-3 pt-1">
          <div className="sticky left-0 z-10 shrink-0 self-stretch flex items-center gap-4 pl-4 pr-3" style={{ background: selected ? "var(--selected-bg)" : "var(--card)" }}>
            <button type="button" onClick={onViewPhotos} className="shrink-0">
              <Avatar className="h-14 w-14 hover:ring-2 hover:ring-primary transition-all">
                {candidate.photo_url && <AvatarImage src={candidate.photo_url} alt={candidate.full_name} />}
                <AvatarFallback className="text-[11px]">{candidate.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </button>
            <div className="shrink-0 w-[110px]">
              <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1">FULL NAME</div>
              <div className="text-sm font-semibold line-clamp-2 break-words">{candidate.full_name}</div>
            </div>
          </div>
          <div className={cn("flex-1 flex items-start gap-2", candidate.visa_status === "Waiting Replacement" && "pointer-events-none opacity-60")}>
            {visibleCols.map((col) => {
              const raw = candidate[col.key as keyof Candidate];
              const strVal = raw == null ? "" : String(raw);
              return (
                <div key={col.key} className="shrink-0 w-[110px]">
                  <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1">{col.header}</div>
                  <div className="text-sm text-foreground break-words">
                    {col.type === "copy" ? (
                      strVal ? (
                        <button
                          type="button"
                          className="text-left text-sm font-mono text-foreground hover:text-primary transition-colors cursor-pointer"
                          onClick={() => { navigator.clipboard.writeText(strVal); toast.success("Copied!"); }}
                          title="Click to copy"
                        >{strVal}</button>
                      ) : <span className="text-muted-foreground">—</span>
                    ) : col.type === "text" ? (
                      <InlineText value={strVal} onSave={(v) => handleColUpdate(col.key, v)} suggestions={col.key === "narrative" ? narrativeSuggestions : undefined} />
                    ) : col.type === "date" ? (
                      col.key === "medical_date" && strVal ? (
                        <span className="break-words">{(() => {
                          const d = new Date(strVal + "T00:00:00");
                          const dd = String(d.getDate()).padStart(2, "0");
                          const mm = String(d.getMonth() + 1).padStart(2, "0");
                          const yyyy = d.getFullYear();
                          const days = Math.max(1, Math.floor((Date.now() - d.getTime()) / 86400000));
                          return <>{`${dd}/${mm}/${yyyy}`}<br /><span className="text-muted-foreground text-xs">({days} days ago)</span></>;
                        })()}</span>
                      ) : (
                        <InlineDate value={strVal} showDays={col.key === "contract_date"} onSave={(v) => handleColUpdate(col.key, v)} />
                      )
                    ) : col.type === "select" ? (
                      col.key === "unfilled_lmis" ? (
                        <div className="flex flex-col gap-0.5">
                          {(() => {
                            const ca = candidate as any;
                            const bothIds = !!(ca.lmis_id_url && ca.lmis_id_relative_url);
                            const items: React.ReactNode[] = [];
                            if (ca.lmis_insu_url) items.push(
                              <div key="insu" className="flex items-center gap-1">
                                <button type="button" onClick={() => setLmisFilesOpen(true)} className="text-[10px] font-semibold text-green-700 dark:text-green-400 hover:underline w-7 shrink-0">INSU</button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.lmis_insu_url); }} className="text-green-700 dark:text-green-400 hover:opacity-70"><Download className="h-3 w-3" /></button>
                              </div>
                            );
                            if (ca.lmis_coc_url) items.push(
                              <div key="coc" className="flex items-center gap-1">
                                <button type="button" onClick={() => setLmisFilesOpen(true)} className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 hover:underline w-7 shrink-0">COC</button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.lmis_coc_url); }} className="text-blue-700 dark:text-blue-400 hover:opacity-70"><Download className="h-3 w-3" /></button>
                              </div>
                            );
                            if (ca.lmis_id_url || ca.lmis_id_relative_url) items.push(
                              <div key="id" className="flex items-center gap-1">
                                <button type="button" onClick={() => setLmisFilesOpen(true)} className="text-[10px] font-semibold text-purple-700 dark:text-purple-400 hover:underline w-7 shrink-0">{bothIds ? "ID'S" : "ID"}</button>
                                {ca.lmis_id_url && <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.lmis_id_url); }} className="text-purple-700 dark:text-purple-400 hover:opacity-70"><Download className="h-3 w-3" /></button>}
                                {bothIds && <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.lmis_id_relative_url); }} className="text-purple-700 dark:text-purple-400 hover:opacity-70"><Download className="h-3 w-3" /></button>}
                              </div>
                            );
                            return items.length > 0
                              ? items
                              : <button type="button" onClick={() => setLmisFilesOpen(true)} className="text-muted-foreground text-sm">—</button>;
                          })()}
                        </div>
                      ) : col.key === "coc_status" && strVal === "Placed" ? (
                        <div className="flex items-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <InlineSelect value={strVal} options={col.options} onSave={(v) => handleColUpdate(col.key, v)} />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="rounded-none text-xs p-2 space-y-0.5">
                                <div className="font-semibold">{(candidate as any).coc_agency_name || "—"}</div>
                                <div>{(candidate as any).coc_agency_phone || "No phone"}</div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setCocPlacedName((candidate as any).coc_agency_name ?? ""); setCocPlacedPhone((candidate as any).coc_agency_phone ?? ""); setCocPlacedOpen(true); }}>
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      ) : col.key === "insurance_status" && strVal === "Done" ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <InlineSelect value={strVal} options={col.options} onSave={(v) => handleColUpdate(col.key, v)} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="rounded-none text-xs p-2">
                              {(candidate as any).insurance_date
                                ? new Date((candidate as any).insurance_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                                : "No date"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : col.key === "medical_status" ? (
                        <div className="flex items-center gap-1 min-w-0">
                          <InlineSelect value={strVal} options={col.options} onSave={(v) => handleColUpdate(col.key, v)} />
                          {candidate.passport_number && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    disabled={wafidProcChecking}
                                    className="shrink-0 text-muted-foreground hover:text-teal-600 disabled:opacity-40 transition-colors"
                                    onClick={async () => {
                                      setWafidProcChecking(true);
                                      const tid = toast.loading("Connecting to wafid.com…");
                                      try {
                                        const res = await checkWafidProcFn({ data: { candidateId: candidate.id } });
                                        if (res.status) {
                                          toast.success(`wafid.com · ${res.message}`, { id: tid });
                                          qcProc.invalidateQueries({ queryKey: ["manager-candidates"] });
                                        } else {
                                          toast.info(`wafid.com · ${res.message}`, { id: tid });
                                        }
                                      } catch (e) {
                                        toast.error(`wafid.com · ${String(e)}`, { id: tid });
                                      } finally {
                                        setWafidProcChecking(false);
                                      }
                                    }}
                                  >
                                    {wafidProcChecking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="rounded-none text-xs p-2">
                                  {wafidProcChecking ? "Connecting to wafid.com…" : "Check on wafid.com"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      ) : (
                        <InlineSelect value={strVal} options={col.options} onSave={(v) => handleColUpdate(col.key, v)} />
                      )
                    ) : col.type === "select-dynamic" ? (
                      <InlineSelect
                        value={strVal}
                        options={officesByCountry[candidate.destination_country ?? ""] ?? []}
                        onSave={(v) => handleColUpdate(col.key, v)}
                      />
                    ) : col.type === "upload" ? (
                      (() => {
                        const ca = candidate as any;
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
                        return (
                          <div className="flex flex-col gap-0.5">
                            {ticketItems.length > 0
                              ? ticketItems
                              : <button type="button" onClick={() => setTicketFilesOpen(true)} className="text-muted-foreground text-sm">—</button>}
                          </div>
                        );
                      })()
                    ) : null}
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
            {(candidate as any).delete_reason ? (
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                ⏳ Pending Deletion
              </span>
            ) : (
              <button
                onClick={() => setDeleteRequestOpen(true)}
                className="text-xs text-destructive hover:underline"
              >
                Delete
              </button>
            )}
            <button onClick={() => setHistoryOpen(true)} className="text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1">
              <History className="h-3 w-3" /> History
            </button>
          </div>
        </div>
      </div>
    {deleteRequestOpen && (
      <DeleteReasonDialog
        onConfirm={(reason) => { onUpdateField("delete_reason", reason); setDeleteRequestOpen(false); }}
        onClose={() => setDeleteRequestOpen(false)}
      />
    )}
    {requireDate && (
      <Dialog open onOpenChange={(o) => { if (!o) setRequireDate(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Date Required</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Please fill in the <strong>{requireDate.label}</strong> before setting the status to{" "}
            <strong>"{requireDate.pendingStatus}"</strong>.
          </p>
          <div className="py-2">
            <Input
              type="date"
              value={pendingDate}
              onChange={(e) => setPendingDate(e.target.value)}
              className="rounded-none h-9"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRequireDate(null)}>Cancel</Button>
            <Button
              disabled={!pendingDate}
              onClick={() => {
                if (!pendingDate) return;
                let finalStatus = requireDate.pendingStatus;
                if (finalStatus === "Fit" && medDaysAgo(pendingDate) >= 90) {
                  toast.error("Medical date is over 90 days ago — status set to Expired");
                  finalStatus = "Expired";
                }
                onUpdateField(requireDate.field, pendingDate);
                onUpdateField(requireDate.statusField, finalStatus);
                if (finalStatus === "Fit") onUpdateField("lmis_status", "Not tested");
                setRequireDate(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    {embassyOpen && (
      <Dialog open onOpenChange={(o) => { if (!o) { setEmbassyOpen(false); setEmbassyStep("ask"); setEmbassyReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Passport Accepted?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tasheer is Done for <strong>{candidate.full_name}</strong>. Is the passport accepted?
          </p>
          <DialogFooter className="flex gap-2 sm:justify-start">
            <Button onClick={() => {
              onUpdateField("tasheer_status", "Done");
              onUpdateField("passport_accepted", "true");
              onUpdateField("wokala_status", "Unpaid");
              onUpdateField("visa_status", "Ready for embassy");
              setEmbassyOpen(false);
            }}>
              Yes — Accepted
            </Button>
            <Button variant="outline" onClick={() => {
              onUpdateField("tasheer_status", "Ready");
              onUpdateField("passport_accepted", "false");
              onUpdateField("wokala_status", "Unpaid");
              setEmbassyOpen(false);
            }}>
              No — Not Accepted
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    {visaReturnOpen && (
      <Dialog open onOpenChange={(o) => { if (!o) { setVisaReturnOpen(false); setVisaReturnReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Visa Returned — Reason Required</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Why was the visa returned for <strong>{candidate.full_name}</strong>?</p>
          <Textarea rows={3} placeholder="Enter reason…" value={visaReturnReason} onChange={(e) => setVisaReturnReason(e.target.value)} />
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => { setVisaReturnOpen(false); setVisaReturnReason(""); }}>Cancel</Button>
            <Button
              disabled={!visaReturnReason.trim()}
              onClick={() => {
                onUpdateField("visa_status", "Returned");
                onUpdateField("remark", visaReturnReason.trim());
                setVisaReturnOpen(false);
                setVisaReturnReason("");
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    {ticketHoldOpen && (
      <Dialog open onOpenChange={(o) => { if (!o) { setTicketHoldOpen(false); setTicketHoldReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ticket Hold — Reason Required</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Why is the ticket on hold for <strong>{candidate.full_name}</strong>?</p>
          <Textarea rows={3} placeholder="Enter reason…" value={ticketHoldReason} onChange={(e) => setTicketHoldReason(e.target.value)} />
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => { setTicketHoldOpen(false); setTicketHoldReason(""); }}>Cancel</Button>
            <Button
              disabled={!ticketHoldReason.trim()}
              onClick={() => {
                onUpdateField("ticket_status", "Hold");
                onUpdateField("processing_notes", ticketHoldReason.trim());
                setTicketHoldOpen(false);
                setTicketHoldReason("");
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    {cocPlacedOpen && (
      <Dialog open onOpenChange={(o) => { if (!o) setCocPlacedOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>COC Placed — Agency Details</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Enter the agency name and phone number for <strong>{candidate.full_name}</strong>.
          </p>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Agency Name"
              value={cocPlacedName}
              onChange={(e) => setCocPlacedName(e.target.value)}
              className="rounded-none h-9"
            />
            <Input
              placeholder="Phone Number"
              value={cocPlacedPhone}
              onChange={(e) => setCocPlacedPhone(e.target.value)}
              className="rounded-none h-9"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCocPlacedOpen(false)}>Cancel</Button>
            <Button
              disabled={!cocPlacedName.trim() || !cocPlacedPhone.trim()}
              onClick={() => {
                onUpdateField("coc_status", "Placed");
                onUpdateField("coc_agency_name", cocPlacedName.trim());
                onUpdateField("coc_agency_phone", cocPlacedPhone.trim());
                setCocPlacedOpen(false);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    {lmisFilesOpen && (
      <LmisFilesDialog
        candidate={candidate}
        onUpdateField={(field, value) => onUpdateField(field, value)}
        onClose={() => setLmisFilesOpen(false)}
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
        onUpdateField={(field, value) => onUpdateField(field, value)}
        onClose={() => setTicketFilesOpen(false)}
      />
    )}
    {embassyOverwriteOpen && (
      <Dialog open onOpenChange={(o) => { if (!o) setEmbassyOverwriteOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Overwrite Embassy Date?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Embassy date is already set to{" "}
            <strong>{new Date((candidate as any).embassy_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</strong>.
            Replace with today's date?
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmbassyOverwriteOpen(false)}>No, keep existing</Button>
            <Button onClick={() => { onUpdateField("embassy_date", new Date().toISOString().split("T")[0]); setEmbassyOverwriteOpen(false); }}>
              Yes, update to today
            </Button>
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
