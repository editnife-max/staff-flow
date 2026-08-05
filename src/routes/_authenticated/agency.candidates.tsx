import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState, useEffect, useRef } from "react";
import {
  Search, SlidersHorizontal, RotateCcw, ChevronDown, ChevronUp,
  ArrowUpDown, Users, User, BookOpen, Briefcase, Heart, Send,
  Play, Download, Eye, FileText, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, calcAge } from "@/lib/utils";
import { X } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { getStaffList, sendCandidatesNotification } from "@/lib/notifications.functions";
import { getAgencyCvTemplate } from "@/lib/agencies.functions";
import { CvPreview, candidateToCanvas } from "@/components/cv-preview";
import { canvasToPdf, downloadDocx } from "@/lib/pdf-export";
import { renderAsync as docxRenderAsync } from "docx-preview";
import type { CvTemplate } from "@/lib/docx-fill";
import { buildFilledDocx } from "@/lib/docx-fill";
import { useAuth } from "@/hooks/use-auth";
import { LangContext } from "@/routes/_authenticated/agency";
import { translateNamesToArabic } from "@/lib/translate.functions";

export const Route = createFileRoute("/_authenticated/agency/candidates")({
  head: () => ({ meta: [{ title: "Candidates — Agency Portal" }] }),
  component: AgencyCandidatesPage,
});

type Candidate = {
  id: string;
  full_name: string;
  photo_url: string | null;
  full_photo_url: string | null;
  passport_scan_url: string | null;
  video_url: string | null;
  occupation: string | null;
  country: string | null;
  gender: string | null;
  dob: string | null;
  age: number | null;
  religion: string | null;
  marital_status: string | null;
  children: number | null;
  birth_place: string | null;
  living_town: string | null;
  education: string | null;
  experience: string | null;
  experience_country: string | null;
  experience_years: string | null;
  english_level: string | null;
  arabic_level: string | null;
  spoken_languages: string | null;
  weight: number | null;
  height: number | null;
  skills: string | null;
  notes: string | null;
  remark: string | null;
  medical_status: string | null;
  passport_status: string | null;
  passport_number: string | null;
  passport_issue_date: string | null;
  passport_expiry_date: string | null;
  place_of_issue: string | null;
  labour_id: string | null;
  coc_status: string | null;
  selected_by: string | null;
  cv_sent_to: string | null;
  status: string;
};

const AR_VALUES: Record<string, string> = {
  "Muslim":      "مسلم",
  "Non-muslim":  "غير مسلم",
  "Yes":         "نعم",
  "No":          "لا",
  "Female":      "أنثى",
  "Male":        "ذكر",
  "Single":      "أعزب/عزباء",
  "Married":     "متزوج/ة",
  "Experienced": "ذو خبرة",
  "Fit":         "لائق",
  "Not Fit":     "غير لائق",
};

function tv(val: string | number | null | undefined, lang: "en" | "ar"): string {
  if (val == null || val === "") return "—";
  if (lang === "ar") return AR_VALUES[String(val)] ?? String(val);
  return String(val);
}

const UI = {
  en: {
    pageTitle: "Candidates",
    pageDesc: (n: number) => `${n} candidate${n !== 1 ? "s" : ""} sent to your agency`,
    filters: "Filters", search: "Search by name…", reset: "Reset",
    selectAll: "Select all", selectedCount: (n: number) => `${n} selected`, clear: "Clear",
    sendSelected: (n: number) => `Selected (${n})`, sendReserved: (n: number) => `Reserved (${n})`,
    loading: "Loading…", noResults: "No candidates found.",
    ageFrom: "Age from", ageTo: "Age to",
    dialogTitle: (type: string, n: number) => `${type} — ${n} candidate${n !== 1 ? "s" : ""}`,
    staffLabel: "Staff member", staffPlaceholder: "Select staff…", noStaff: "No staff available",
    msgLabel: "Message", optional: "(optional)", msgPlaceholder: "Add a note for the staff member…",
    cancel: "Cancel", markAs: (t: string) => `Mark as ${t}`, sending: "Sending…",
    sortNewest: "Newest first", sortOldest: "Oldest first",
    genderAll: "Gender", female: "Female", male: "Male",
    religionAll: "Religion", muslim: "Muslim", nonMuslim: "Non-muslim",
    expAll: "Experience", experienced: "Experienced", nonExperienced: "Non-Experienced",
    maritalAll: "Marital Status", single: "Single", married: "Married",
    noVideo: "No video", viewCv: "View CV", cvPdf: "CV PDF", play: "Play", video: "Video",
    age: "Age", religion: "Religion", exp: "Exp.",
  },
  ar: {
    pageTitle: "المرشحون",
    pageDesc: (n: number) => `${n} مرشح تم إرسالهم لوكالتك`,
    filters: "الفلاتر", search: "البحث بالاسم…", reset: "إعادة تعيين",
    selectAll: "تحديد الكل", selectedCount: (n: number) => `${n} محدد`, clear: "مسح",
    sendSelected: (n: number) => `المحددون (${n})`, sendReserved: (n: number) => `المحجوزون (${n})`,
    loading: "جار التحميل…", noResults: "لا يوجد مرشحون.",
    ageFrom: "العمر من", ageTo: "إلى",
    dialogTitle: (type: string, n: number) => `${type} — ${n} مرشح`,
    staffLabel: "عضو الفريق", staffPlaceholder: "اختر عضو الفريق…", noStaff: "لا يوجد فريق",
    msgLabel: "الرسالة", optional: "(اختياري)", msgPlaceholder: "أضف ملاحظة لعضو الفريق…",
    cancel: "إلغاء", markAs: (t: string) => `تحديد كـ ${t}`, sending: "جار الإرسال…",
    sortNewest: "الأحدث أولاً", sortOldest: "الأقدم أولاً",
    genderAll: "الجنس", female: "أنثى", male: "ذكر",
    religionAll: "الديانة", muslim: "مسلم", nonMuslim: "غير مسلم",
    expAll: "الخبرة", experienced: "ذو خبرة", nonExperienced: "بدون خبرة",
    maritalAll: "الحالة الاجتماعية", single: "أعزب/عزباء", married: "متزوج/ة",
    noVideo: "لا يوجد فيديو", viewCv: "عرض", cvPdf: "تنزيل", play: "تشغيل", video: "فيديو",
    age: "العمر", religion: "الديانة", exp: "الخبرة",
  },
};

const initialFilters = {
  sort:       "newest",
  gender:     "all",
  religion:   "all",
  experience: "all",
  marital:    "all",
  ageFrom:    "",
  ageTo:      "",
};

function AgencyCandidatesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { lang } = React.useContext(LangContext);
  const ui = UI[lang];
  const [nameMap, setNameMap]         = useState<Record<string, string>>({});
  const nameMapRef                    = React.useRef<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);
  const [search, setSearch]           = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters]         = useState(initialFilters);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [sendOpen, setSendOpen]       = useState(false);
  const [sendType, setSendType]       = useState<"Selected" | "Reserved">("Selected");
  const [staffId, setStaffId]         = useState("");
  const [message, setMessage]         = useState("");

  const fetchStaff     = useServerFn(getStaffList);
  const doSend         = useServerFn(sendCandidatesNotification);
  const fetchTemplate  = useServerFn(getAgencyCvTemplate);
  const doTranslate    = useServerFn(translateNamesToArabic);

  const { data: agencyTemplate = null } = useQuery<CvTemplate | null>({
    queryKey: ["agency-cv-template", user?.id],
    queryFn: () => fetchTemplate(),
    enabled: !!user?.id,
  });

  const { data: candidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ["agency-candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select(
          "id,full_name,photo_url,full_photo_url,passport_scan_url,video_url," +
          "occupation,country,gender,dob,age,religion,marital_status,children," +
          "birth_place,living_town,education,experience,experience_country,experience_years," +
          "english_level,arabic_level,spoken_languages,weight,height,skills,notes,remark," +
          "medical_status,passport_status,passport_number,passport_issue_date," +
          "passport_expiry_date,place_of_issue,labour_id,coc_status," +
          "selected_by,cv_sent_to,status"
        )
        .eq("status", "available")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Candidate[];
    },
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-list"],
    queryFn: () => fetchStaff({}),
    enabled: sendOpen,
  });

  const ageFromNum = filters.ageFrom !== "" ? Number(filters.ageFrom) : null;
  const ageToNum   = filters.ageTo   !== "" ? Number(filters.ageTo)   : null;

  const filtered = candidates
    .filter((c) => !search || c.full_name.toLowerCase().includes(search.toLowerCase()))
    .filter((c) => filters.gender     === "all" || c.gender         === filters.gender)
    .filter((c) => filters.religion   === "all" || c.religion       === filters.religion)
    .filter((c) => filters.experience === "all" || (filters.experience === "Yes" ? c.experience === "Yes" : c.experience !== "Yes"))
    .filter((c) => filters.marital    === "all" || c.marital_status === filters.marital)
    .filter((c) => { const a = calcAge(c.dob) ?? c.age; return ageFromNum === null || (a != null && a >= ageFromNum); })
    .filter((c) => { const a = calcAge(c.dob) ?? c.age; return ageToNum   === null || (a != null && a <= ageToNum);  })
    .sort((a, b) =>
      filters.sort === "oldest"
        ? (a as any).created_at?.localeCompare((b as any).created_at ?? "") ?? 0
        : ((b as any).created_at ?? "").localeCompare((a as any).created_at ?? "")
    );

  const activeCount = Object.entries(filters).filter(([k, v]) => k !== "sort" && v && v !== "all").length;

  // Translate names to Arabic via Claude when lang switches to "ar"
  React.useEffect(() => {
    if (lang !== "ar" || !candidates.length) return;
    const untranslated = candidates
      .map((c) => c.full_name)
      .filter((n) => !nameMapRef.current[n]);
    if (!untranslated.length) return;
    setTranslating(true);
    doTranslate({ data: { names: untranslated } })
      .then((result: Record<string, string>) => {
        nameMapRef.current = { ...nameMapRef.current, ...result };
        setNameMap((prev) => ({ ...prev, ...result }));
      })
      .catch(() => toast.error("Failed to translate names"))
      .finally(() => setTranslating(false));
  }, [lang, candidates.length]);

  function resetFilters() { setFilters(initialFilters); setSearch(""); }

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((c) => c.id)));
  }

  function closeSend() { setSendOpen(false); setStaffId(""); setMessage(""); }

  function openSend(type: "Selected" | "Reserved") { setSendType(type); setSendOpen(true); }

  const sendMut = useMutation({
    mutationFn: () => {
      const prefix = `[${sendType}]`;
      const combined = message ? `${prefix} ${message}` : prefix;
      return doSend({ data: { staffUserId: staffId, candidateIds: [...selected], message: combined, notifType: sendType === "Reserved" ? "reserved" : "selected" } });
    },
    onSuccess: () => {
      toast.success(`${selected.size} candidate${selected.size !== 1 ? "s" : ""} marked as ${sendType}`);
      setSelected(new Set());
      closeSend();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title={ui.pageTitle}
        description={ui.pageDesc(filtered.length)}
      />
      {translating && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          {lang === "ar" ? "جار ترجمة الأسماء…" : "Translating names…"}
        </div>
      )}

      {/* Filter panel */}
      <Card className="rounded-none mb-3">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowFilters((s) => !s)}
                className="flex items-center gap-2 text-xs font-bold text-foreground hover:text-primary transition-colors"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                {ui.filters}
                {activeCount > 0 && (
                  <span className="rounded-none bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">
                    {activeCount}
                  </span>
                )}
                {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={ui.search}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-7 text-xs rounded-none w-52"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              disabled={activeCount === 0 && !search}
            >
              <RotateCcw className="h-3 w-3" /> {ui.reset}
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <FilterSelect
                value={filters.sort} onChange={(v) => setFilters({ ...filters, sort: v })}
                icon={ArrowUpDown}
                options={[{ value: "newest", label: ui.sortNewest }, { value: "oldest", label: ui.sortOldest }]}
              />
              <FilterSelect
                placeholder={ui.genderAll} value={filters.gender} icon={User}
                onChange={(v) => setFilters({ ...filters, gender: v })}
                options={[{ value: "all", label: "-----" }, { value: "Female", label: ui.female }, { value: "Male", label: ui.male }]}
              />
              <FilterSelect
                placeholder={ui.religionAll} value={filters.religion} icon={BookOpen}
                onChange={(v) => setFilters({ ...filters, religion: v })}
                options={[{ value: "all", label: "-----" }, { value: "Muslim", label: ui.muslim }, { value: "Non-muslim", label: ui.nonMuslim }]}
              />
              <FilterSelect
                placeholder={ui.expAll} value={filters.experience} icon={Briefcase}
                onChange={(v) => setFilters({ ...filters, experience: v })}
                options={[{ value: "all", label: "-----" }, { value: "Yes", label: ui.experienced }, { value: "No", label: ui.nonExperienced }]}
              />
              <FilterSelect
                placeholder={ui.maritalAll} value={filters.marital} icon={Heart}
                onChange={(v) => setFilters({ ...filters, marital: v })}
                options={[{ value: "all", label: "-----" }, { value: "Single", label: ui.single }, { value: "Married", label: ui.married }]}
              />
              <div className={cn(
                "flex items-center gap-1 h-7 px-2 border rounded-none text-[13px] font-medium transition-colors",
                (filters.ageFrom || filters.ageTo)
                  ? "bg-black/10 border-black/20 text-[#181A27] dark:bg-white/10 dark:border-white/20 dark:text-white"
                  : "bg-muted/40 border-border text-muted-foreground",
              )}>
                <Users className="h-3 w-3 shrink-0" />
                <input
                  type="number"
                  placeholder={ui.ageFrom}
                  value={filters.ageFrom}
                  onChange={(e) => setFilters({ ...filters, ageFrom: e.target.value })}
                  className="w-14 bg-transparent outline-none text-xs placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  min={0}
                />
                <span className="text-muted-foreground">–</span>
                <input
                  type="number"
                  placeholder={ui.ageTo}
                  value={filters.ageTo}
                  onChange={(e) => setFilters({ ...filters, ageTo: e.target.value })}
                  className="w-14 bg-transparent outline-none text-xs placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  min={0}
                />
                {(filters.ageFrom || filters.ageTo) && (
                  <button type="button" onClick={() => setFilters({ ...filters, ageFrom: "", ageTo: "" })}
                    className="p-0.5 text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selection toolbar */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-3 mb-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <Checkbox
              checked={selected.size > 0 && selected.size === filtered.length}
              onCheckedChange={toggleAll}
              aria-label="Select all"
            />
            {selected.size > 0 ? ui.selectedCount(selected.size) : ui.selectAll}
          </label>
          {selected.size > 0 && (
            <>
              <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => openSend("Selected")}>
                <Send className="h-3.5 w-3.5" />
                {ui.sendSelected(selected.size)}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => openSend("Reserved")}>
                <Send className="h-3.5 w-3.5" />
                {ui.sendReserved(selected.size)}
              </Button>
              <button type="button" onClick={() => setSelected(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground">
                {ui.clear}
              </button>
            </>
          )}
        </div>
      )}

      {/* Results grid */}
      {isLoading ? (
        <Card className="rounded-none">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">{ui.loading}</CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="rounded-none">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">{ui.noResults}</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
          {filtered.map((c) => (
            <AgencyCandidateCard
              key={c.id}
              candidate={c}
              selected={selected.has(c.id)}
              onToggle={() => toggleSelect(c.id)}
              template={agencyTemplate}
              lang={lang}
              translatedName={nameMap[c.full_name]}
            />
          ))}
        </div>
      )}

      {/* Send to staff dialog */}
      <Dialog open={sendOpen} onOpenChange={(o) => { if (!o) closeSend(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{ui.dialogTitle(sendType, selected.size)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{ui.staffLabel}</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder={ui.staffPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {staffList.length === 0
                    ? <SelectItem value="none" disabled>{ui.noStaff}</SelectItem>
                    : staffList.map((s) => (
                        <SelectItem key={s.id} value={s.user_id}>{s.name}</SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{ui.msgLabel} <span className="text-muted-foreground text-xs">{ui.optional}</span></Label>
              <Textarea
                placeholder={ui.msgPlaceholder}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeSend}>{ui.cancel}</Button>
            <Button onClick={() => sendMut.mutate()} disabled={!staffId || sendMut.isPending}>
              {sendMut.isPending ? ui.sending : ui.markAs(sendType)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function CvViewDialog({ candidate, template, onClose, translatedName }: { candidate: Candidate; template: CvTemplate | null; onClose: () => void; translatedName?: string }) {
  const displayName = translatedName ?? candidate.full_name;
  const [downloading, setDownloading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const isDocx = !!template && template.file_url.split("?")[0].toLowerCase().endsWith(".docx");

  useEffect(() => {
    if (!isDocx) return;
    let cancelled = false;
    setPreviewLoading(true);
    (async () => {
      try {
        const bytes = await buildFilledDocx(template!, candidate as any, false);
        if (cancelled || !previewRef.current) return;
        previewRef.current.innerHTML = "";
        const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        await docxRenderAsync(buf, previewRef.current, undefined, {
          className: "docx-agency-preview",
          inWrapper: true,
          ignoreHeight: true,
        });
      } catch {
        toast.error("Failed to render CV preview");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isDocx, template?.id, candidate.id]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (isDocx) {
        const bytes = await buildFilledDocx(template!, candidate as any);
        downloadDocx(bytes, `${candidate.full_name} — CV.docx`);
      } else {
        const canvas = await candidateToCanvas(candidate as any, template);
        await canvasToPdf(canvas, `${candidate.full_name} — CV.pdf`);
      }
    } catch {
      toast.error("Failed to generate CV");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>CV — {displayName}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[68vh] overflow-auto">
          {isDocx ? (
            <div className="relative min-h-[400px]">
              {previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              <div ref={previewRef} className="docx-agency-preview-wrapper" />
            </div>
          ) : (
            <CvPreview candidate={candidate as any} template={template} />
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={handleDownload} disabled={downloading} className="gap-1.5">
            <Download className="h-4 w-4" />
            {downloading ? "Generating…" : "Download CV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AgencyCandidateCard({
  candidate: c, selected, onToggle, template, lang = "en", translatedName,
}: { candidate: Candidate; selected: boolean; onToggle: () => void; template: CvTemplate | null; lang?: "en" | "ar"; translatedName?: string }) {
  const t = UI[lang];
  const displayName = lang === "ar" && translatedName ? translatedName : c.full_name;
  const [cvOpen, setCvOpen]   = useState(false);
  const [dlCv, setDlCv]       = useState(false);
  const [dlVideo, setDlVideo] = useState(false);

  const age = calcAge(c.dob) ?? c.age;

  const handleDownloadCv = async () => {
    setDlCv(true);
    try {
      if (template && template.file_url.split("?")[0].toLowerCase().endsWith(".docx")) {
        const bytes = await buildFilledDocx(template, c as any);
        downloadDocx(bytes, `${c.full_name} — CV.docx`);
      } else {
        const canvas = await candidateToCanvas(c as any, template);
        await canvasToPdf(canvas, `${c.full_name} — CV.pdf`);
      }
    } catch {
      toast.error("Failed to generate CV");
    } finally {
      setDlCv(false);
    }
  };

  const handleDownloadVideo = async () => {
    if (!c.video_url || dlVideo) return;
    const url = c.video_url;
    const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
    if (gdMatch) {
      window.open(`https://drive.google.com/uc?export=download&id=${gdMatch[1]}`, "_blank");
      return;
    }
    setDlVideo(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const ext = url.split("?")[0].split(".").pop() ?? "mp4";
      a.download = `${c.full_name} — video.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch {
      window.open(url, "_blank");
    } finally {
      setDlVideo(false);
    }
  };

  return (
    <>
      <div className={cn(
        "border border-border rounded-sm bg-card shadow-sm overflow-hidden flex flex-col transition-colors",
        selected && "ring-2 ring-primary/60",
      )}>
        {/* Square passport-size photo */}
        <div className="relative aspect-square bg-muted overflow-hidden">
          {c.photo_url ? (
            <img
              src={c.photo_url}
              alt={c.full_name}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
              <User className="h-10 w-10" />
            </div>
          )}
          <div className="absolute top-1 left-1">
            <Checkbox
              checked={selected}
              onCheckedChange={onToggle}
              aria-label="Select candidate"
              className="h-3.5 w-3.5 bg-white/90 border-white/80 shadow data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
          </div>
          <div className="absolute top-1 right-1">
            <StatusBadge status={c.status} />
          </div>
        </div>

        {/* Candidate info */}
        <div className="p-2 space-y-1 flex-1" dir={lang === "ar" ? "rtl" : "ltr"}>
          <div className="font-semibold text-xs leading-tight line-clamp-2">{displayName}</div>
          <div className="space-y-0.5 text-[10px]">
            <div className="flex items-baseline gap-1">
              <span className="font-medium text-muted-foreground w-12 shrink-0">{t.age}</span>
              <span className="text-foreground">{age ?? "—"}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-medium text-muted-foreground w-12 shrink-0">{t.religion}</span>
              <span className="text-foreground truncate">{tv(c.religion, lang)}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-medium text-muted-foreground w-12 shrink-0">{t.exp}</span>
              <span className="text-foreground truncate">{tv(c.experience, lang)}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-2 pb-2 space-y-1">
          <div className="grid grid-cols-2 gap-0.5">
            <Button
              size="sm" variant="outline"
              className="h-6 text-[10px] gap-0.5 rounded-sm px-1"
              onClick={() => setCvOpen(true)}
            >
              <Eye className="h-2.5 w-2.5 shrink-0" /> {t.viewCv}
            </Button>
            <Button
              size="sm" variant="outline"
              className="h-6 text-[10px] gap-0.5 rounded-sm px-1"
              onClick={handleDownloadCv}
              disabled={dlCv}
            >
              <FileText className="h-2.5 w-2.5 shrink-0" />
              {dlCv ? "…" : t.cvPdf}
            </Button>
          </div>
          {c.video_url ? (
            <div className="grid grid-cols-2 gap-0.5">
              <Button
                size="sm" variant="outline"
                className="h-6 text-[10px] gap-0.5 rounded-sm px-1"
                onClick={() => window.open(c.video_url!, "_blank")}
              >
                <Play className="h-2.5 w-2.5 shrink-0 fill-current" /> {t.play}
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-6 text-[10px] gap-0.5 rounded-sm px-1"
                onClick={handleDownloadVideo}
                disabled={dlVideo}
              >
                {dlVideo ? <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" /> : <Download className="h-2.5 w-2.5 shrink-0" />}
                {dlVideo ? "…" : t.video}
              </Button>
            </div>
          ) : (
            <div className="h-6 flex items-center justify-center text-[9px] text-muted-foreground/40 border border-dashed border-border rounded-sm">
              {t.noVideo}
            </div>
          )}
        </div>
      </div>

      {cvOpen && <CvViewDialog candidate={c} template={template} onClose={() => setCvOpen(false)} translatedName={translatedName} />}

    </>
  );
}


function FilterSelect({
  value, onChange, options, placeholder, icon: Icon,
}: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string; icon?: React.ElementType;
}) {
  const isReset = value === "all" || !value;
  return (
    <div className="flex items-center gap-0.5">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cn(
          "border shadow-none w-auto h-7 px-2 gap-1.5 transition-colors rounded-none text-[13px] font-medium [&>svg]:shrink-0",
          isReset
            ? "bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            : "bg-black/10 border-black/20 text-[#181A27] dark:bg-white/10 dark:border-white/20 dark:text-white",
        )}>
          {Icon && <Icon className="h-3 w-3 shrink-0" />}
          {isReset ? <span>{placeholder}</span> : <SelectValue />}
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="py-1 px-2 focus:bg-muted/50">
              <span className={cn("text-[13px]", o.value === "all" ? "text-muted-foreground" : "text-[#181A27] dark:text-white")}>
                {o.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!isReset && (
        <button type="button" onClick={() => onChange("all")}
          className="rounded-none p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Clear filter">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
