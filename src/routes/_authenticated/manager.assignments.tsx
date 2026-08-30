import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Globe, Building2, ChevronRight, ChevronLeft, FileText, Upload, ExternalLink, CheckCircle2, CircleDot, Clock, Download, BarChart3, AlertCircle, Lock, Unlock, KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import { addCountry, deleteCountry, addOffice, deleteOffice, lockOffice, deleteCvTemplate, optimizeCvTemplate, saveMusanedCredentials, saveEnjazCredentials } from "@/lib/assignments.functions";

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
const EXPERIENCE_OPTIONS     = ["Yes", "No"];
const ENGLISH_LEVEL_OPTIONS  = ["Poor", "Little", "Fair", "Good"];

const YES_NO_OPTIONS = ["Yes", "No"];

const DEFAULT_CV_REQ = {
  medical: "Fit", narrative: "all", experience: "all", coc: "Done",
  passport_scan: "all", full_size_photo: "all", photo_cv: "all",
  alert_after_days: "90",
};

function AssignmentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const addCountryFn   = useServerFn(addCountry);
  const delCountryFn   = useServerFn(deleteCountry);
  const addOfficeFn    = useServerFn(addOffice);
  const delOfficeFn    = useServerFn(deleteOffice);
  const lockOfficeFn   = useServerFn(lockOffice);
  const delTemplateFn         = useServerFn(deleteCvTemplate);
  const optimizeTemplateFn    = useServerFn(optimizeCvTemplate);
  const saveMusanedFn         = useServerFn(saveMusanedCredentials);
  const saveEnjazFn           = useServerFn(saveEnjazCredentials);

  // ── Musaned setup ────────────────────────────────────────────────────────────
  const [musanedEditing,      setMusanedEditing]      = useState(false);
  const [musanedEmail,        setMusanedEmail]        = useState("");
  const [musanedPasswordDraft, setMusanedPasswordDraft] = useState("");
  const [musanedShowPassword, setMusanedShowPassword] = useState(false);
  const [musanedShowSaved,    setMusanedShowSaved]    = useState(false);

  // ── Enjaz setup ──────────────────────────────────────────────────────────────
  const [enjazEditing,       setEnjazEditing]       = useState(false);
  const [enjazEmail,         setEnjazEmail]         = useState("");
  const [enjazPasswordDraft, setEnjazPasswordDraft] = useState("");
  const [enjazShowPassword,  setEnjazShowPassword]  = useState(false);
  const [enjazShowSaved,     setEnjazShowSaved]     = useState(false);

  // ── CV requirement days ──────────────────────────────────────────────────────
  const [cvDaysEdit,  setCvDaysEdit]  = useState(false);
  const [cvDaysDraft, setCvDaysDraft] = useState("");
  const [summaryView, setSummaryView] = useState(false);
  const [alertEdit, setAlertEdit] = useState(false);
  const [alertDraft, setAlertDraft] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["manager-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("cv_days_threshold, cv_page_requirements, musaned_email, musaned_password, enjaz_email, enjaz_password")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const cvDaysThreshold = profile?.cv_days_threshold ?? 7;

  const updateThreshold = useMutation({
    mutationFn: async (days: number) => {
      const { error } = await supabase
        .from("profiles")
        .update({ cv_days_threshold: days })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manager-profile", user?.id] });
      setCvDaysEdit(false);
      toast.success("CV requirement days updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── selected country for office panel ──────────────────────────────────────
  const [activeCountryId, setActiveCountryId] = useState<string | null>(null);

  // ── add-country form ────────────────────────────────────────────────────────
  const [newCountryName, setNewCountryName] = useState("");
  const [newCountryFlag, setNewCountryFlag] = useState("🌍");

  // ── add-office form ─────────────────────────────────────────────────────────
  const [newOfficeName, setNewOfficeName] = useState("");

  // ── CV page requirements ─────────────────────────────────────────────────────
  const cvReq = useMemo(() => {
    const saved = (profile as any)?.cv_page_requirements;
    return saved ? { ...DEFAULT_CV_REQ, ...saved } : { ...DEFAULT_CV_REQ };
  }, [profile]);

  const saveCvReq = useMutation({
    mutationFn: async (req: typeof DEFAULT_CV_REQ) => {
      const { error } = await supabase
        .from("profiles")
        .update({ cv_page_requirements: req } as any)
        .eq("id", user!.id);
      if (error) throw error;
    },
    onMutate: async (req) => {
      await qc.cancelQueries({ queryKey: ["manager-profile", user?.id] });
      const prev = qc.getQueryData(["manager-profile", user?.id]);
      qc.setQueryData(["manager-profile", user?.id], (old: any) => ({ ...old, cv_page_requirements: req }));
      return { prev };
    },
    onError: (_e, _req, ctx) => {
      qc.setQueryData(["manager-profile", user?.id], (ctx as any)?.prev);
      toast.error("Failed to save CV requirements");
    },
  });

  // ── pagination ───────────────────────────────────────────────────────────────
  const PAGE = 5;
  const [countryPage,  setCountryPage]  = useState(0);
  const [officePage,   setOfficePage]   = useState(0);
  const [templatePage, setTemplatePage] = useState(0);

  // reset office page when active country changes
  useEffect(() => { setOfficePage(0); setSummaryView(false); }, [activeCountryId]);

  // ── cv template form ─────────────────────────────────────────────────────────
  const [newTemplateName, setNewTemplateName] = useState("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateUploading, setTemplateUploading] = useState(false);
  const [templateUploadStep, setTemplateUploadStep] = useState<"uploading" | null>(null);

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

  const { data: summaryCandidates = [] } = useQuery({
    queryKey: ["office-summary-candidates", user?.id, activeCountry?.id],
    enabled: !!user && summaryView && !!activeCountry,
    staleTime: 0,
    queryFn: async () => {
      const names = offices.filter(o => o.country_id === activeCountry!.id).map(o => o.name);
      if (names.length === 0) return [];
      const { data } = await supabase
        .from("candidates")
        .select("id, cv_sent_to, cv_resent_offices, selected_by")
        .in("cv_sent_to", names);
      return (data ?? []) as { id: string; cv_sent_to: string | null; cv_resent_offices: string[] | null; selected_by: string | null }[];
    },
  });

  const officeStats = useMemo(() => activeOffices.map(o => {
    const name = o.name;
    const sent = summaryCandidates.filter(c => c.cv_sent_to === name);
    const resentReceived = summaryCandidates.filter(c => (c.cv_resent_offices as string[] | null)?.includes(name) ?? false);
    return { name, sent: sent.length, selected: sent.filter(c => !!c.selected_by).length, pending: sent.filter(c => !c.selected_by).length, resent: resentReceived.length };
  }), [activeOffices, summaryCandidates]);

  function downloadOfficeCsv() {
    const header = "Office,Sent,Selected,Pending,Resent\n";
    const rows = officeStats.map(s => `"${s.name}",${s.sent},${s.selected},${s.pending},${s.resent}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${activeCountry?.name ?? "offices"}-summary-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

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
      toast.success("Office removed — candidates unassigned");
      qc.invalidateQueries({ queryKey: ["assignment-offices"] });
      qc.invalidateQueries({ queryKey: ["agencies-offices-names"] });
      qc.invalidateQueries({ queryKey: ["mgr-cv-candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lockOfficeMut = useMutation({
    mutationFn: ({ id, locked }: { id: string; locked: boolean }) =>
      lockOfficeFn({ data: { id, locked } }),
    onSuccess: (result: any, { locked }) => {
      const redistributed = result?.redistributed ?? 0;
      if (locked) {
        toast.success(
          redistributed > 0
            ? `Office locked — ${redistributed} candidate${redistributed === 1 ? "" : "s"} redistributed`
            : "Office locked — will not receive candidates",
        );
      } else {
        toast.success("Office unlocked");
      }
      qc.invalidateQueries({ queryKey: ["assignment-offices"] });
      if (locked && redistributed > 0) {
        qc.invalidateQueries({ queryKey: ["mgr-cv-candidates"] });
        qc.invalidateQueries({ queryKey: ["staff-dashboard-candidates"] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const musanedSaved = !!profile?.musaned_email;
  const enjazSaved   = !!profile?.enjaz_email;

  const saveMusanedMut = useMutation({
    mutationFn: () => saveMusanedFn({ data: { email: musanedEmail.trim(), password: musanedPasswordDraft } }),
    onSuccess: () => {
      toast.success("Musaned credentials saved");
      qc.invalidateQueries({ queryKey: ["manager-profile", user?.id] });
      setMusanedEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveEnjazMut = useMutation({
    mutationFn: () => saveEnjazFn({ data: { email: enjazEmail.trim(), password: enjazPasswordDraft } }),
    onSuccess: () => {
      toast.success("Enjaz+ credentials saved");
      qc.invalidateQueries({ queryKey: ["manager-profile", user?.id] });
      setEnjazEditing(false);
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
    setTemplateUploadStep("uploading");
    try {
      const buf = await templateFile.arrayBuffer();
      const u8  = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
      const fileBase64 = btoa(binary);

      await optimizeTemplateFn({
        data: { name: newTemplateName.trim(), fileBase64, fileName: templateFile.name },
      });
      toast.success(`Template "${newTemplateName.trim()}" uploaded`);
      qc.invalidateQueries({ queryKey: ["cv-templates"] });
      setNewTemplateName("");
      setTemplateFile(null);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setTemplateUploading(false);
      setTemplateUploadStep(null);
    }
  }

  // ── paginated slices ─────────────────────────────────────────────────────────
  const countrySlice  = countries.slice(countryPage * PAGE, countryPage * PAGE + PAGE);
  const officeSlice   = activeOffices.slice(officePage * PAGE, officePage * PAGE + PAGE);
  const templateSlice = cvTemplates.slice(templatePage * PAGE, templatePage * PAGE + PAGE);

  function Pager({ page, total, set }: { page: number; total: number; set: (n: number) => void }) {
    const pages = Math.ceil(total / PAGE);
    if (pages <= 1) return null;
    return (
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <button type="button" onClick={() => set(page - 1)} disabled={page === 0}
          className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs text-muted-foreground">{page + 1} / {pages}</span>
        <button type="button" onClick={() => set(page + 1)} disabled={page >= pages - 1}
          className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] mx-[79.6px] py-4 gap-4">

      {/* Title */}
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-base font-semibold tracking-tight">Assignments</h1>
        <p className="text-xs text-muted-foreground">Countries and offices appear in Processing filters.</p>
      </div>

      {/* ── Row 1: Countries + Offices ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">

        {/* Countries */}
        <div className="border border-border bg-background flex flex-col min-h-0">
          <div className="px-3 py-2 border-b flex items-center gap-2 bg-muted/30 shrink-0">
            <Globe className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold">Countries</span>
            <span className="ml-auto text-xs text-muted-foreground">{countries.length} total</span>
          </div>
          <div className="p-3 space-y-2 flex-1 overflow-y-auto">
            <div className="flex gap-1.5">
              <select value={newCountryFlag} onChange={(e) => setNewCountryFlag(e.target.value)}
                className="h-8 border border-border bg-background text-sm px-1 focus:outline-none shrink-0">
                {COMMON_FLAGS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <Input className="h-8 rounded-none text-sm flex-1" placeholder="Country name…"
                value={newCountryName} onChange={(e) => setNewCountryName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newCountryName.trim()) addCountryMut.mutate(); }} />
              <Button size="sm" className="h-8 rounded-none px-3 text-sm gap-1"
                disabled={!newCountryName.trim() || addCountryMut.isPending}
                onClick={() => addCountryMut.mutate()}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            <div className="space-y-0.5">
              {countries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No countries yet.</p>
              ) : countrySlice.map((c) => (
                <button key={c.id} type="button" onClick={() => setActiveCountryId(c.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors group",
                    activeCountry?.id === c.id ? "bg-primary/8 text-primary font-medium" : "hover:bg-muted/50",
                  )}>
                  <span className="text-sm">{c.flag}</span>
                  <span className="flex-1 truncate text-sm">{c.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {offices.filter((o) => o.country_id === c.id).length}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); delCountryMut.mutate(c.id); }}
                    disabled={delCountryMut.isPending}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </button>
              ))}
            </div>
            <Pager page={countryPage} total={countries.length} set={setCountryPage} />
          </div>
        </div>

        {/* Offices */}
        <div className="border border-border bg-background flex flex-col min-h-0">
          <div className="px-3 py-2 border-b flex items-center gap-2 bg-muted/30 shrink-0">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold">Offices</span>
            {activeCountry && (
              <span className="text-xs text-muted-foreground truncate">— {activeCountry.flag} {activeCountry.name}</span>
            )}
            {activeCountry && (
              <>
                <span className="ml-auto text-xs text-muted-foreground shrink-0">{activeOffices.length} total</span>
                <button type="button" onClick={() => setSummaryView(v => !v)}
                  className={cn("h-6 px-2 text-xs border flex items-center gap-1 rounded-none transition-colors shrink-0",
                    summaryView ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                  <BarChart3 className="h-3 w-3" /> Summary
                </button>
              </>
            )}
          </div>
          <div className="p-3 space-y-2 flex-1 overflow-y-auto">
            {!activeCountry ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Globe className="h-7 w-7 mb-2 opacity-20" />
                <p className="text-sm">Select a country to manage offices.</p>
              </div>
            ) : summaryView ? (
              /* ── Summary view ── */
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{activeOffices.length} offices · {activeCountry.flag} {activeCountry.name}</span>
                  <button type="button" onClick={downloadOfficeCsv}
                    className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Download className="h-3 w-3" /> Export CSV
                  </button>
                </div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 font-semibold text-muted-foreground">Office</th>
                      <th className="text-right py-1.5 font-semibold text-muted-foreground">Sent</th>
                      <th className="text-right py-1.5 font-semibold text-emerald-600 dark:text-emerald-400">Selected</th>
                      <th className="text-right py-1.5 font-semibold text-amber-600 dark:text-amber-400">Pending</th>
                      <th className="text-right py-1.5 font-semibold text-blue-600 dark:text-blue-400">Resent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {officeStats.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">No offices yet</td></tr>
                    ) : officeStats.map(s => (
                      <tr key={s.name} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="py-1.5 font-medium truncate max-w-[110px]">{s.name}</td>
                        <td className="text-right py-1.5 tabular-nums">{s.sent}</td>
                        <td className="text-right py-1.5 tabular-nums text-emerald-600 dark:text-emerald-400">{s.selected}</td>
                        <td className="text-right py-1.5 tabular-nums text-amber-600 dark:text-amber-400">{s.pending}</td>
                        <td className="text-right py-1.5 tabular-nums text-blue-600 dark:text-blue-400">{s.resent}</td>
                      </tr>
                    ))}
                    {officeStats.length > 1 && (
                      <tr className="border-t-2 border-border font-semibold">
                        <td className="py-1.5">Total</td>
                        <td className="text-right py-1.5 tabular-nums">{officeStats.reduce((a, s) => a + s.sent, 0)}</td>
                        <td className="text-right py-1.5 tabular-nums text-emerald-600 dark:text-emerald-400">{officeStats.reduce((a, s) => a + s.selected, 0)}</td>
                        <td className="text-right py-1.5 tabular-nums text-amber-600 dark:text-amber-400">{officeStats.reduce((a, s) => a + s.pending, 0)}</td>
                        <td className="text-right py-1.5 tabular-nums text-blue-600 dark:text-blue-400">{officeStats.reduce((a, s) => a + s.resent, 0)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* ── List view ── */
              <>
                <div className="flex gap-1.5">
                  <Input className="h-8 rounded-none text-sm flex-1" placeholder="Office name…"
                    value={newOfficeName} onChange={(e) => setNewOfficeName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && newOfficeName.trim()) addOfficeMut.mutate(); }} />
                  <Button size="sm" className="h-8 rounded-none px-3 text-sm gap-1"
                    disabled={!newOfficeName.trim() || addOfficeMut.isPending}
                    onClick={() => addOfficeMut.mutate()}>
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                </div>
                <div className="space-y-0.5">
                  {activeOffices.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No offices yet.</p>
                  ) : officeSlice.map((o) => {
                    const isLocked = (o as any).is_locked === true;
                    return (
                      <div key={o.id} className={cn(
                        "flex items-center gap-2 px-3 py-1.5 hover:bg-muted/40 group",
                        isLocked && "opacity-50",
                      )}>
                        {isLocked
                          ? <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          : <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        }
                        <span className={cn("flex-1 truncate text-sm", isLocked && "line-through text-muted-foreground")}>
                          {o.name}
                        </span>
                        {isLocked && (
                          <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-sm shrink-0">
                            Locked
                          </span>
                        )}
                        <button
                          type="button"
                          title={isLocked ? "Unlock office" : "Lock office (stop receiving candidates)"}
                          onClick={() => lockOfficeMut.mutate({ id: o.id, locked: !isLocked })}
                          disabled={lockOfficeMut.isPending}
                          className={cn(
                            "opacity-0 group-hover:opacity-100 transition-opacity",
                            isLocked ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground hover:text-amber-500",
                          )}
                        >
                          {isLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                        </button>
                        <button type="button" onClick={() => delOfficeMut.mutate(o.id)}
                          disabled={delOfficeMut.isPending}
                          className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <Pager page={officePage} total={activeOffices.length} set={setOfficePage} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: CV Templates + CV Page Requirements ──────────────────── */}
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">

        {/* CV Templates */}
        <div className="border border-border bg-background flex flex-col min-h-0">
          <div className="px-3 py-2 border-b flex items-center gap-2 bg-muted/30 shrink-0">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold">CV Templates</span>
            <span className="ml-auto text-xs text-muted-foreground">{cvTemplates.length} uploaded</span>
          </div>
          <div className="p-3 space-y-2 flex-1 overflow-y-auto">
            <div className="flex gap-1.5">
              <Input className="h-8 rounded-none text-sm flex-1" placeholder="Template name…"
                value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newTemplateName.trim() && templateFile) handleTemplateUpload(); }} />
              <label className={cn(
                "h-8 inline-flex items-center gap-1 px-2 border text-sm font-medium cursor-pointer transition-colors shrink-0",
                templateFile ? "border-primary/50 bg-primary/5 text-primary" : "border-input bg-background text-muted-foreground hover:bg-muted",
              )}>
                <Upload className="h-3.5 w-3.5" />
                {templateFile ? (templateFile.name.length > 10 ? templateFile.name.slice(0, 9) + "…" : templateFile.name) : "File"}
                <input type="file" accept=".docx" className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setTemplateFile(file);
                    if (file && !newTemplateName.trim()) {
                      const baseName = file.name.replace(/\.[^.]+$/, "");
                      setNewTemplateName(baseName);
                    }
                  }} />
              </label>
              <Button size="sm" className="h-8 rounded-none px-3 text-sm"
                disabled={!newTemplateName.trim() || !templateFile || templateUploading}
                onClick={handleTemplateUpload}>
                {templateUploadStep === "uploading" ? "Uploading…" : "Upload"}
              </Button>
            </div>
            {templateFile && (
              <p className="text-xs text-muted-foreground truncate">
                {templateFile.name}
                <button type="button" className="ml-1.5 text-destructive hover:underline"
                  onClick={() => setTemplateFile(null)}>×</button>
              </p>
            )}
            {cvTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No templates yet.</p>
            ) : (
              <div className="space-y-0.5">
                {templateSlice.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/40 group">
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="flex-1 truncate text-sm font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                    <a href={t.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button type="button" onClick={() => delTemplateMut.mutate(t.id)}
                      disabled={delTemplateMut.isPending}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Pager page={templatePage} total={cvTemplates.length} set={setTemplatePage} />
          </div>
        </div>

        {/* CV Page Requirements */}
        <div className="border border-border bg-background flex flex-col min-h-0">
          <div className="px-3 py-2 border-b flex items-center gap-2 bg-muted/30 shrink-0">
            <CircleDot className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold">CV Page Requirements</span>
            <Link to="/manager/candidates" search={{ tab: "available" }} className="ml-auto text-xs text-primary hover:underline flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> View Qualifying
            </Link>
          </div>
          <div className="p-3 space-y-2 flex-1 overflow-y-auto">
            {/* CV Requirement Days */}
            <div className="flex items-center gap-2 px-3 py-1.5 border border-teal-200 bg-teal-50/40 dark:border-teal-800/40 dark:bg-teal-900/10">
              <Clock className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="text-sm text-muted-foreground w-24 shrink-0">Resend after</span>
              {cvDaysEdit ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    autoFocus type="number" min={1} value={cvDaysDraft}
                    onChange={(e) => setCvDaysDraft(e.target.value)}
                    className="w-14 border border-input rounded-none px-2 h-7 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { const n = parseInt(cvDaysDraft); if (!isNaN(n) && n > 0) updateThreshold.mutate(n); }
                      if (e.key === "Escape") setCvDaysEdit(false);
                    }}
                  />
                  <span className="text-xs text-muted-foreground">days</span>
                  <Button size="sm" className="h-7 rounded-none px-2 text-xs"
                    disabled={updateThreshold.isPending}
                    onClick={() => { const n = parseInt(cvDaysDraft); if (!isNaN(n) && n > 0) updateThreshold.mutate(n); }}>
                    {updateThreshold.isPending ? "…" : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 rounded-none px-2 text-xs"
                    onClick={() => setCvDaysEdit(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-base font-bold text-teal-700 dark:text-teal-300">{cvDaysThreshold}</span>
                  <span className="text-xs text-muted-foreground">days</span>
                  <button type="button" className="ml-auto text-xs text-primary hover:underline"
                    onClick={() => { setCvDaysDraft(String(cvDaysThreshold)); setCvDaysEdit(true); }}>
                    Edit
                  </button>
                </div>
              )}
            </div>
            {/* Alert after — configurable unselected alert threshold */}
            <div className="flex items-center gap-2 px-3 py-1.5 border border-orange-200 bg-orange-50/40 dark:border-orange-800/40 dark:bg-orange-900/10">
              <AlertCircle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
              <span className="text-sm text-muted-foreground w-24 shrink-0">Alert after</span>
              {alertEdit ? (
                <div className="flex items-center gap-2 flex-1">
                  <input autoFocus type="number" min={1} value={alertDraft}
                    onChange={(e) => setAlertDraft(e.target.value)}
                    className="w-14 border border-input rounded-none px-2 h-7 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { const n = parseInt(alertDraft); if (!isNaN(n) && n > 0) { saveCvReq.mutate({ ...cvReq, alert_after_days: String(n) }); setAlertEdit(false); } }
                      if (e.key === "Escape") setAlertEdit(false);
                    }} />
                  <span className="text-xs text-muted-foreground">days</span>
                  <Button size="sm" className="h-7 rounded-none px-2 text-xs" disabled={saveCvReq.isPending}
                    onClick={() => { const n = parseInt(alertDraft); if (!isNaN(n) && n > 0) { saveCvReq.mutate({ ...cvReq, alert_after_days: String(n) }); setAlertEdit(false); } }}>
                    {saveCvReq.isPending ? "…" : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 rounded-none px-2 text-xs" onClick={() => setAlertEdit(false)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-base font-bold text-orange-700 dark:text-orange-300">{cvReq.alert_after_days}</span>
                  <span className="text-xs text-muted-foreground">days</span>
                  <button type="button" className="ml-auto text-xs text-primary hover:underline"
                    onClick={() => { setAlertDraft(cvReq.alert_after_days); setAlertEdit(true); }}>
                    Edit
                  </button>
                </div>
              )}
            </div>
            {/* Status — locked */}
            <div className="flex items-center gap-2 px-3 py-1.5 border border-emerald-200 bg-emerald-50/40 dark:border-emerald-800/40 dark:bg-emerald-900/10">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-sm text-muted-foreground w-16 shrink-0">Status</span>
              <span className="flex-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">Available</span>
              <span className="text-xs text-muted-foreground">Locked</span>
            </div>
            {/* Filter rows — 2-column grid */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {(
                [
                  { key: "medical",         label: "Medical",       opts: MEDICAL_OPTIONS },
                  { key: "narrative",       label: "Narrative",     opts: narrativeOpts },
                  { key: "experience",      label: "Experience",    opts: EXPERIENCE_OPTIONS },
                  { key: "coc",             label: "COC",           opts: COC_OPTIONS },
                  { key: "passport_scan",   label: "Passport Scan", opts: YES_NO_OPTIONS },
                  { key: "full_size_photo", label: "Full Size Photo", opts: YES_NO_OPTIONS },
                  { key: "photo_cv",        label: "Photo CV",      opts: YES_NO_OPTIONS },
                ] as { key: keyof typeof DEFAULT_CV_REQ; label: string; opts: string[] }[]
              ).map(({ key, label, opts }) => (
                <div key={key} className="flex items-center gap-2 min-w-0">
                  <span className={cn(
                    "text-sm w-20 shrink-0 truncate",
                    cvReq[key] !== "all" ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground",
                  )}>{label}</span>
                  <Select value={cvReq[key]} onValueChange={(v) => saveCvReq.mutate({ ...cvReq, [key]: v })}>
                    <SelectTrigger className="h-7 flex-1 rounded-none text-xs min-w-0">
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

      {/* ── Row 3: Musaned Setup ─────────────────────────────────────────── */}
      <div className="border border-border bg-background flex flex-col shrink-0">
        <div className="px-3 py-2 border-b flex items-center gap-2 bg-muted/30">
          <KeyRound className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold">Musaned Setup</span>
          <a href="https://tawtheeq.musaned.com.sa/" target="_blank" rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1 ml-1">
            <ExternalLink className="h-3 w-3" /> tawtheeq.musaned.com.sa
          </a>
          <span className="ml-auto text-xs text-muted-foreground">Staff HR pool credentials</span>
        </div>
        <div className="px-3 py-2.5">
          {musanedEditing ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-16 shrink-0">Email</span>
                <Input autoFocus className="h-8 rounded-none text-sm w-56" type="email"
                  placeholder="Musaned email…"
                  value={musanedEmail} onChange={(e) => setMusanedEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") setMusanedEditing(false); }} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-16 shrink-0">Password</span>
                <div className="flex gap-1">
                  <Input className="h-8 rounded-none text-sm w-56"
                    type={musanedShowPassword ? "text" : "password"}
                    placeholder="Musaned password…"
                    value={musanedPasswordDraft} onChange={(e) => setMusanedPasswordDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") setMusanedEditing(false); }} />
                  <button type="button"
                    className="px-2 border border-input h-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setMusanedShowPassword((v) => !v)}>
                    {musanedShowPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" className="h-8 rounded-none px-3 text-sm"
                  disabled={!musanedEmail.trim() || !musanedPasswordDraft.trim() || saveMusanedMut.isPending}
                  onClick={() => saveMusanedMut.mutate()}>
                  {saveMusanedMut.isPending ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-none px-3 text-sm"
                  onClick={() => setMusanedEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : musanedSaved ? (
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-16 shrink-0">Email</span>
                <span className="text-sm font-medium">{profile?.musaned_email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-16 shrink-0">Password</span>
                <span className="text-sm font-medium font-mono tracking-widest">
                  {musanedShowSaved
                    ? profile?.musaned_password
                    : "•".repeat(Math.min(profile?.musaned_password?.length ?? 8, 16))}
                </span>
                <button type="button" className="text-muted-foreground hover:text-foreground"
                  onClick={() => setMusanedShowSaved((v) => !v)}>
                  {musanedShowSaved ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <button type="button" className="ml-auto text-xs text-primary hover:underline"
                onClick={() => {
                  setMusanedEmail(profile?.musaned_email ?? "");
                  setMusanedPasswordDraft(profile?.musaned_password ?? "");
                  setMusanedShowPassword(false);
                  setMusanedEditing(true);
                }}>
                Edit
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground flex-1">
                Not configured. Save Musaned credentials so staff can access the HR pool.
              </p>
              <button type="button" className="text-xs text-primary hover:underline shrink-0"
                onClick={() => { setMusanedEmail(""); setMusanedPasswordDraft(""); setMusanedShowPassword(false); setMusanedEditing(true); }}>
                Configure
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 4: Enjaz+ Setup ──────────────────────────────────────────────── */}
      <div className="border border-border bg-background flex flex-col shrink-0">
        <div className="px-3 py-2 border-b flex items-center gap-2 bg-muted/30">
          <KeyRound className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold">Enjaz+ Setup</span>
          <a href="https://enjazplus.com/login" target="_blank" rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1 ml-1">
            <ExternalLink className="h-3 w-3" /> enjazplus.com
          </a>
          <span className="ml-auto text-xs text-muted-foreground">Staff visa portal credentials</span>
        </div>
        <div className="px-3 py-2.5">
          {enjazEditing ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-16 shrink-0">Email</span>
                <Input autoFocus className="h-8 rounded-none text-sm w-56" type="email"
                  placeholder="Enjaz+ email…"
                  value={enjazEmail} onChange={(e) => setEnjazEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") setEnjazEditing(false); }} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-16 shrink-0">Password</span>
                <div className="flex gap-1">
                  <Input className="h-8 rounded-none text-sm w-56"
                    type={enjazShowPassword ? "text" : "password"}
                    placeholder="Enjaz+ password…"
                    value={enjazPasswordDraft} onChange={(e) => setEnjazPasswordDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") setEnjazEditing(false); }} />
                  <button type="button"
                    className="px-2 border border-input h-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setEnjazShowPassword((v) => !v)}>
                    {enjazShowPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" className="h-8 rounded-none px-3 text-sm"
                  disabled={!enjazEmail.trim() || !enjazPasswordDraft.trim() || saveEnjazMut.isPending}
                  onClick={() => saveEnjazMut.mutate()}>
                  {saveEnjazMut.isPending ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-none px-3 text-sm"
                  onClick={() => setEnjazEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : enjazSaved ? (
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-16 shrink-0">Email</span>
                <span className="text-sm font-medium">{profile?.enjaz_email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-16 shrink-0">Password</span>
                <span className="text-sm font-medium font-mono tracking-widest">
                  {enjazShowSaved
                    ? profile?.enjaz_password
                    : "•".repeat(Math.min(profile?.enjaz_password?.length ?? 8, 16))}
                </span>
                <button type="button" className="text-muted-foreground hover:text-foreground"
                  onClick={() => setEnjazShowSaved((v) => !v)}>
                  {enjazShowSaved ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <button type="button" className="ml-auto text-xs text-primary hover:underline"
                onClick={() => {
                  setEnjazEmail(profile?.enjaz_email ?? "");
                  setEnjazPasswordDraft(profile?.enjaz_password ?? "");
                  setEnjazShowPassword(false);
                  setEnjazEditing(true);
                }}>
                Edit
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground flex-1">
                Not configured. Save Enjaz+ credentials so staff can access the visa portal.
              </p>
              <button type="button" className="text-xs text-primary hover:underline shrink-0"
                onClick={() => { setEnjazEmail(""); setEnjazPasswordDraft(""); setEnjazShowPassword(false); setEnjazEditing(true); }}>
                Configure
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
