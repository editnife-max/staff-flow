import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { Plus, Trash2, Globe, Building2, ChevronRight, FileText, Upload, ExternalLink, CheckCircle2, CircleDot } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import { addCountry, deleteCountry, addOffice, deleteOffice, addCvTemplate, deleteCvTemplate } from "@/lib/assignments.functions";

type AssignCountry  = Database["public"]["Tables"]["assignment_countries"]["Row"];
type AssignOffice   = Database["public"]["Tables"]["assignment_offices"]["Row"];
type CvTemplate     = Database["public"]["Tables"]["cv_templates"]["Row"];

export const Route = createFileRoute("/_authenticated/manager/assignments")({
  head: () => ({ meta: [{ title: "Assignments — Staff-Flow" }] }),
  component: AssignmentsPage,
});

const COMMON_FLAGS = ["🇸🇦","🇰🇼","🇦🇪","🇯🇴","🇱🇧","🇶🇦","🇧🇭","🇴🇲","🇮🇶","🇾🇪","🌍"];

const CV_REQ_KEY        = "cv-page-requirements";
const MEDICAL_OPTIONS   = ["Fit", "Booked", "Unfit", "No", "In progress", "Expired"];
const COC_OPTIONS       = ["Done", "No", "Booked", "Placed", "Yitazez", "Pending Release"];
const AGE_OPTIONS       = ["18-25", "26-35", "36-45", "46-99"];
const GENDER_OPTIONS    = ["Male", "Female"];
const RELIGION_OPTIONS  = ["Muslim", "Non-muslim"];
const EXPERIENCE_OPTIONS     = ["Yes", "No", "None"];
const ENGLISH_LEVEL_OPTIONS  = ["Poor", "Little", "Fair", "Good"];

const DEFAULT_CV_REQ = {
  age: "all", gender: "all", religion: "all", medical: "Fit",
  narrative: "all", experience: "all", coc: "Done",
  musaned: "all", selected_by: "all", cv_sent_to: "all",
  english_level: "all",
};

function AssignmentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const addCountryFn   = useServerFn(addCountry);
  const delCountryFn   = useServerFn(deleteCountry);
  const addOfficeFn    = useServerFn(addOffice);
  const delOfficeFn    = useServerFn(deleteOffice);
  const addTemplateFn  = useServerFn(addCvTemplate);
  const delTemplateFn  = useServerFn(deleteCvTemplate);

  // ── selected country for office panel ──────────────────────────────────────
  const [activeCountryId, setActiveCountryId] = useState<string | null>(null);

  // ── add-country form ────────────────────────────────────────────────────────
  const [newCountryName, setNewCountryName] = useState("");
  const [newCountryFlag, setNewCountryFlag] = useState("🌍");

  // ── add-office form ─────────────────────────────────────────────────────────
  const [newOfficeName, setNewOfficeName] = useState("");

  // ── CV page requirements ─────────────────────────────────────────────────────
  const [cvReq, setCvReq] = useState(() => {
    try {
      const saved = localStorage.getItem(CV_REQ_KEY);
      return saved ? { ...DEFAULT_CV_REQ, ...JSON.parse(saved) } : { ...DEFAULT_CV_REQ };
    } catch { return { ...DEFAULT_CV_REQ }; }
  });

  useEffect(() => {
    localStorage.setItem(CV_REQ_KEY, JSON.stringify(cvReq));
  }, [cvReq]);

  // ── cv template form ─────────────────────────────────────────────────────────
  const [newTemplateName, setNewTemplateName] = useState("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateUploading, setTemplateUploading] = useState(false);

  // ── queries ─────────────────────────────────────────────────────────────────
  const { data: countries = [] } = useQuery({
    queryKey: ["assignment-countries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_countries")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as AssignCountry[];
    },
  });

  const { data: offices = [] } = useQuery({
    queryKey: ["assignment-offices", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_offices")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as AssignOffice[];
    },
  });

  const { data: cvTemplates = [] } = useQuery({
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

  const { data: agencyOptions = [] } = useQuery({
    queryKey: ["agencies-offices-names"],
    enabled: !!user,
    queryFn: async () => {
      const [agenciesRes, officesRes] = await Promise.all([
        supabase.from("foreign_agencies").select("name").order("name"),
        supabase.from("assignment_offices").select("name").order("name"),
      ]);
      const names = [
        ...(agenciesRes.data ?? []).map((r: any) => r.name as string),
        ...(officesRes.data ?? []).map((r: any) => r.name as string),
      ];
      return [...new Set(names)].sort();
    },
  });

  const narrativeOpts = offices.map((o) => o.name).filter(Boolean).sort();

  const activeCountry = countries.find((c) => c.id === activeCountryId) ?? countries[0] ?? null;
  const activeOffices  = offices.filter((o) => o.country_id === activeCountry?.id);

  // ── mutations ────────────────────────────────────────────────────────────────
  const addCountryMut = useMutation({
    mutationFn: () => addCountryFn({ data: { name: newCountryName.trim(), flag: newCountryFlag } }),
    onSuccess: (row) => {
      toast.success(`Country "${row.name}" added`);
      qc.invalidateQueries({ queryKey: ["assignment-countries"] });
      setNewCountryName("");
      setActiveCountryId(row.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delCountryMut = useMutation({
    mutationFn: (id: string) => delCountryFn({ data: { id } }),
    onSuccess: (_, id) => {
      toast.success("Country removed");
      qc.invalidateQueries({ queryKey: ["assignment-countries"] });
      qc.invalidateQueries({ queryKey: ["assignment-offices"] });
      if (activeCountryId === id) setActiveCountryId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addOfficeMut = useMutation({
    mutationFn: () =>
      addOfficeFn({ data: { name: newOfficeName.trim(), countryId: activeCountry!.id } }),
    onSuccess: (row) => {
      toast.success(`Office "${row.name}" added`);
      qc.invalidateQueries({ queryKey: ["assignment-offices"] });
      qc.invalidateQueries({ queryKey: ["agencies-offices-names"] });
      setNewOfficeName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delOfficeMut = useMutation({
    mutationFn: (id: string) => delOfficeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Office removed");
      qc.invalidateQueries({ queryKey: ["assignment-offices"] });
      qc.invalidateQueries({ queryKey: ["agencies-offices-names"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delTemplateMut = useMutation({
    mutationFn: (id: string) => delTemplateFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Template removed");
      qc.invalidateQueries({ queryKey: ["cv-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleTemplateUpload() {
    if (!newTemplateName.trim() || !templateFile) return;
    setTemplateUploading(true);
    try {
      const ext = (templateFile.name.split(".").pop() ?? "pdf").toLowerCase();
      const path = `cv-templates/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("candidate-files").upload(path, templateFile, { upsert: true });
      if (upErr) throw new Error(upErr.message);
      const { data: urlData } = supabase.storage.from("candidate-files").getPublicUrl(path);
      await addTemplateFn({ data: { name: newTemplateName.trim(), file_url: urlData.publicUrl } });
      toast.success(`Template "${newTemplateName.trim()}" uploaded`);
      qc.invalidateQueries({ queryKey: ["cv-templates"] });
      setNewTemplateName("");
      setTemplateFile(null);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setTemplateUploading(false);
    }
  }

  return (
    <div className="space-y-3 mx-[79.6px]">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold tracking-tight">Assignments</h1>
        <p className="text-xs text-muted-foreground">Countries and offices appear in Processing filters.</p>
      </div>

      {/* ── Row 1: Countries + Offices ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">

        {/* Countries */}
        <div className="border border-border bg-background">
          <div className="px-3 py-2 border-b flex items-center gap-2 bg-muted/30">
            <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs font-semibold">Countries</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{countries.length} total</span>
          </div>
          <div className="p-2 space-y-2">
            <div className="flex gap-1.5">
              <select value={newCountryFlag} onChange={(e) => setNewCountryFlag(e.target.value)}
                className="h-7 border border-border bg-background text-sm px-1 focus:outline-none shrink-0">
                {COMMON_FLAGS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <Input className="h-7 rounded-none text-xs flex-1" placeholder="Country name…"
                value={newCountryName} onChange={(e) => setNewCountryName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newCountryName.trim()) addCountryMut.mutate(); }} />
              <Button size="sm" className="h-7 rounded-none px-2.5 text-xs gap-1"
                disabled={!newCountryName.trim() || addCountryMut.isPending}
                onClick={() => addCountryMut.mutate()}>
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
            <div className="space-y-px max-h-44 overflow-y-auto">
              {countries.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-5">No countries yet.</p>
              ) : countries.map((c) => (
                <button key={c.id} type="button" onClick={() => setActiveCountryId(c.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1 text-left transition-colors group text-xs",
                    activeCountry?.id === c.id ? "bg-primary/8 text-primary font-medium" : "hover:bg-muted/50",
                  )}>
                  <span className="text-sm">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {offices.filter((o) => o.country_id === c.id).length}
                  </span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); delCountryMut.mutate(c.id); }}
                    disabled={delCountryMut.isPending}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Offices */}
        <div className="border border-border bg-background">
          <div className="px-3 py-2 border-b flex items-center gap-2 bg-muted/30">
            <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs font-semibold">Offices</span>
            {activeCountry && (
              <span className="text-[11px] text-muted-foreground">— {activeCountry.flag} {activeCountry.name}</span>
            )}
            {activeCountry && (
              <span className="ml-auto text-[11px] text-muted-foreground">{activeOffices.length} total</span>
            )}
          </div>
          <div className="p-2 space-y-2">
            {!activeCountry ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Globe className="h-7 w-7 mb-2 opacity-20" />
                <p className="text-[11px]">Select a country to manage offices.</p>
              </div>
            ) : (
              <>
                <div className="flex gap-1.5">
                  <Input className="h-7 rounded-none text-xs flex-1" placeholder="Office name…"
                    value={newOfficeName} onChange={(e) => setNewOfficeName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && newOfficeName.trim()) addOfficeMut.mutate(); }} />
                  <Button size="sm" className="h-7 rounded-none px-2.5 text-xs gap-1"
                    disabled={!newOfficeName.trim() || addOfficeMut.isPending}
                    onClick={() => addOfficeMut.mutate()}>
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
                <div className="space-y-px max-h-44 overflow-y-auto">
                  {activeOffices.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground text-center py-5">No offices yet.</p>
                  ) : activeOffices.map((o) => (
                    <div key={o.id} className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-muted/40 group">
                      <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{o.name}</span>
                      <button type="button" onClick={() => delOfficeMut.mutate(o.id)}
                        disabled={delOfficeMut.isPending}
                        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: CV Templates + CV Page Requirements ──────────────────── */}
      <div className="grid grid-cols-2 gap-3 items-start">

        {/* CV Templates */}
        <div className="border border-border bg-background">
          <div className="px-3 py-2 border-b flex items-center gap-2 bg-muted/30">
            <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs font-semibold">CV Templates</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{cvTemplates.length} uploaded</span>
          </div>
          <div className="p-2 space-y-2">
            <div className="flex gap-1.5">
              <Input className="h-7 rounded-none text-xs flex-1" placeholder="Template name…"
                value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newTemplateName.trim() && templateFile) handleTemplateUpload(); }} />
              <label className={cn(
                "h-7 inline-flex items-center gap-1 px-2 border text-xs font-medium cursor-pointer transition-colors shrink-0",
                templateFile ? "border-primary/50 bg-primary/5 text-primary" : "border-input bg-background text-muted-foreground hover:bg-muted",
              )}>
                <Upload className="h-3 w-3" />
                {templateFile ? (templateFile.name.length > 14 ? templateFile.name.slice(0, 12) + "…" : templateFile.name) : "PDF"}
                <input type="file" accept=".pdf,.docx" className="hidden"
                  onChange={(e) => setTemplateFile(e.target.files?.[0] ?? null)} />
              </label>
              <Button size="sm" className="h-7 rounded-none px-2.5 text-xs"
                disabled={!newTemplateName.trim() || !templateFile || templateUploading}
                onClick={handleTemplateUpload}>
                {templateUploading ? "…" : "Upload"}
              </Button>
            </div>
            {templateFile && (
              <p className="text-[11px] text-muted-foreground">
                {templateFile.name}
                <button type="button" className="ml-2 text-destructive hover:underline"
                  onClick={() => setTemplateFile(null)}>remove</button>
              </p>
            )}
            {cvTemplates.length === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center py-5">No templates uploaded yet.</p>
            ) : (
              <div className="space-y-px max-h-44 overflow-y-auto">
                {cvTemplates.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-muted/40 group">
                    <FileText className="h-3 w-3 text-primary shrink-0" />
                    <span className="flex-1 truncate font-medium">{t.name}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                    <a href={t.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors" title="View">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <button type="button" onClick={() => delTemplateMut.mutate(t.id)}
                      disabled={delTemplateMut.isPending}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CV Page Requirements */}
        <div className="border border-border bg-background">
          <div className="px-3 py-2 border-b flex items-center gap-2 bg-muted/30">
            <CircleDot className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs font-semibold">CV Page Requirements</span>
            <span className="ml-auto text-[11px] text-muted-foreground">applied on CV page load</span>
          </div>
          <div className="p-2 space-y-1.5">
            {/* Status — locked */}
            <div className="flex items-center gap-2 px-2 py-1 border border-emerald-200 bg-emerald-50/40 dark:border-emerald-800/40 dark:bg-emerald-900/10 text-xs">
              <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-muted-foreground w-20 shrink-0">Status</span>
              <span className="flex-1 font-semibold text-emerald-700 dark:text-emerald-300">Available</span>
              <span className="text-[10px] text-muted-foreground">Locked</span>
            </div>
            {/* Filter rows — 2-column grid */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              {(
                [
                  { key: "age",          label: "Age",           opts: AGE_OPTIONS },
                  { key: "gender",       label: "Gender",        opts: GENDER_OPTIONS },
                  { key: "religion",     label: "Religion",      opts: RELIGION_OPTIONS },
                  { key: "medical",      label: "Medical",       opts: MEDICAL_OPTIONS },
                  { key: "narrative",    label: "Narrative",     opts: narrativeOpts },
                  { key: "experience",   label: "Experience",    opts: EXPERIENCE_OPTIONS },
                  { key: "coc",          label: "COC",           opts: COC_OPTIONS },
                  { key: "english_level",label: "English Level", opts: ENGLISH_LEVEL_OPTIONS },
                  { key: "musaned",      label: "Country",       opts: countries.map((c) => c.name) },
                  { key: "selected_by",  label: "Selected By",   opts: agencyOptions },
                  { key: "cv_sent_to",   label: "CV Sent To",    opts: agencyOptions },
                ] as { key: keyof typeof DEFAULT_CV_REQ; label: string; opts: string[] }[]
              ).map(({ key, label, opts }) => (
                <div key={key} className="flex items-center gap-1.5 min-w-0">
                  <span className={cn(
                    "text-[11px] w-[4.5rem] shrink-0 truncate",
                    cvReq[key] !== "all" ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground",
                  )}>{label}</span>
                  <Select value={cvReq[key]} onValueChange={(v) => setCvReq((p: typeof cvReq) => ({ ...p, [key]: v }))}>
                    <SelectTrigger className="h-6 flex-1 rounded-none text-[11px] min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs text-muted-foreground">—</SelectItem>
                      {opts.map((o) => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
