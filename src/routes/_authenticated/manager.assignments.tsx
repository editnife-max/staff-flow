import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Globe, Building2, ChevronRight, ChevronLeft, FileText, Upload, ExternalLink, CheckCircle2, CircleDot, Clock, Download, BarChart3, AlertCircle, Lock, Unlock, KeyRound, Eye, EyeOff, Search, Users, GraduationCap, Play, FileSignature, Send, Loader2, ListChecks, Shuffle, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import { ALL_TC_CRITERIA, ALL_TC_CRITERIA_KEYS } from "@/components/candidates/types";
import { addCountry, deleteCountry, addOffice, deleteOffice, lockOffice, deleteCvTemplate, optimizeCvTemplate, saveMusanedCredentials, saveEnjazCredentials, saveMofaCredentials, saveLmisCredentials, getManagerCredentials } from "@/lib/assignments.functions";
import { runLmisPhase1 } from "@/lib/lmis-contract.functions";
import { runMusanedFetch } from "@/lib/musaned.functions";
import { distributeCandidates, autoDistributeUnassigned } from "@/lib/cv-distribution.functions";

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
  base_per_office: "15",
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
  const saveMofaFn            = useServerFn(saveMofaCredentials);
  const saveLmisFn            = useServerFn(saveLmisCredentials);

  // ── dialog ────────────────────────────────────────────────────────────────────
  const [activeSetup, setActiveSetup] = useState<"musaned" | "enjaz" | "mofa" | "lmis" | null>(null);

  // ── Musaned setup ────────────────────────────────────────────────────────────
  const [musanedEmail,        setMusanedEmail]        = useState("");
  const [musanedPasswordDraft, setMusanedPasswordDraft] = useState("");
  const [musanedShowPassword, setMusanedShowPassword] = useState(false);

  // ── Enjaz setup ──────────────────────────────────────────────────────────────
  const [enjazEmail,         setEnjazEmail]         = useState("");
  const [enjazPasswordDraft, setEnjazPasswordDraft] = useState("");
  const [enjazShowPassword,  setEnjazShowPassword]  = useState(false);

  // ── MOFA setup ───────────────────────────────────────────────────────────────
  const [mofaEmail,         setMofaEmail]         = useState("");
  const [mofaPasswordDraft, setMofaPasswordDraft] = useState("");
  const [mofaShowPassword,  setMofaShowPassword]  = useState(false);

  // ── LMIS setup ───────────────────────────────────────────────────────────────
  const [lmisEmail,         setLmisEmail]         = useState("");
  const [lmisPasswordDraft, setLmisPasswordDraft] = useState("");
  const [lmisShowPassword,  setLmisShowPassword]  = useState(false);

  // ── LMIS contract phase 1 ────────────────────────────────────────────────────
  const [phase1Running,    setPhase1Running]    = useState(false);
  const [phase1Result,     setPhase1Result]     = useState<{ checked: number; notTested: number; draft: number; errors: number; log: string[] } | null>(null);
  const [phase1LogOpen,    setPhase1LogOpen]    = useState(false);
  const runPhase1Fn = useServerFn(runLmisPhase1);

  const [musanedRunning,   setMusanedRunning]   = useState(false);
  const [musanedResult,    setMusanedResult]    = useState<{ fetched: number; skipped: number; errors: number; log: string[] } | null>(null);
  const [musanedLogOpen,   setMusanedLogOpen]   = useState(false);
  const runMusanedFn = useServerFn(runMusanedFetch);

  // ── panel dialog ──────────────────────────────────────────────────────────────
  const [panelDialog, setPanelDialog] = useState<"countries" | "offices" | "cvTemplates" | "cvReq" | "tcCriteria" | "cvDist" | null>(null);

  // ── CV Distribution ───────────────────────────────────────────────────────────
  const distributeFn          = useServerFn(distributeCandidates);
  const autoDistUnassignedFn  = useServerFn(autoDistributeUnassigned);
  const [distRunning, setDistRunning] = useState(false);
  const [distResult,  setDistResult]  = useState<{ assigned: number; byOffice: Record<string, number> } | null>(null);

  // ── CV requirement days ──────────────────────────────────────────────────────
  const [cvDaysEdit,  setCvDaysEdit]  = useState(false);
  const [cvDaysDraft, setCvDaysDraft] = useState("");
  const [summaryView, setSummaryView] = useState(false);
  const [alertEdit, setAlertEdit] = useState(false);
  const [alertDraft, setAlertDraft] = useState("");
  const [baseEdit,  setBaseEdit]  = useState(false);
  const [baseDraft, setBaseDraft] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["manager-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("cv_days_threshold, cv_page_requirements")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const cvDaysThreshold = profile?.cv_days_threshold ?? 7;

  const getCredentialsFn = useServerFn(getManagerCredentials);
  const { data: credentials } = useQuery({
    queryKey: ["manager-credentials", user?.id],
    enabled: !!user,
    queryFn: () => getCredentialsFn(),
    staleTime: 0,
  });

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

  const tcEnabled = (profile?.cv_page_requirements as any)?.tc_enabled !== false;

  const tcCriteriaKeys: string[] = useMemo(() => {
    const keys = (profile?.cv_page_requirements as any)?.tc_criteria_keys;
    return Array.isArray(keys) ? keys : ALL_TC_CRITERIA_KEYS;
  }, [profile]);

  const saveTcCriteriaMut = useMutation({
    mutationFn: async (keys: string[]) => {
      const current = (profile?.cv_page_requirements as Record<string, unknown>) ?? {};
      const { error } = await supabase
        .from("profiles")
        .update({ cv_page_requirements: { ...current, tc_criteria_keys: keys } } as any)
        .eq("id", user!.id);
      if (error) throw error;
    },
    onMutate: async (keys) => {
      await qc.cancelQueries({ queryKey: ["manager-profile", user?.id] });
      const prev = qc.getQueryData(["manager-profile", user?.id]);
      qc.setQueryData(["manager-profile", user?.id], (old: any) => ({
        ...old,
        cv_page_requirements: { ...(old?.cv_page_requirements ?? {}), tc_criteria_keys: keys },
      }));
      return { prev };
    },
    onError: (_e, _keys, ctx) => {
      qc.setQueryData(["manager-profile", user?.id], (ctx as any)?.prev);
      toast.error("Failed to save TC criteria");
    },
  });

  const updateTcEnabled = useMutation({
    mutationFn: async (enabled: boolean) => {
      const current = (profile?.cv_page_requirements as Record<string, unknown>) ?? {};
      const { error } = await supabase
        .from("profiles")
        .update({ cv_page_requirements: { ...current, tc_enabled: enabled } })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manager-profile", user?.id] });
      qc.invalidateQueries({ queryKey: ["manager-tc-enabled"] });
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

  // auto-distribute unassigned CV Ready candidates on page load
  useEffect(() => {
    if (!user) return;
    autoDistUnassignedFn({}).then((r) => {
      if (r.assigned > 0) {
        toast.info(`${r.assigned} CV Ready candidate${r.assigned > 1 ? "s" : ""} auto-distributed`);
        qc.invalidateQueries({ queryKey: ["manager-candidates"] });
        qc.invalidateQueries({ queryKey: ["cv-dist-stats", user.id] });
        qc.invalidateQueries({ queryKey: ["office-summary-candidates", user.id] });
      }
    }).catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const { data: narrativeOpts = [] } = useQuery({
    queryKey: ["available-narratives", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("candidates")
        .select("narrative")
        .eq("status", "available")
        .not("narrative", "is", null);
      return [...new Set((data ?? []).map((r: any) => r.narrative as string).filter(Boolean))].sort();
    },
  });

  // ── CV Distribution stats ─────────────────────────────────────────────────────
  const { data: cvDistStats } = useQuery({
    queryKey: ["cv-dist-stats", user?.id],
    enabled: !!user && panelDialog === "cvDist",
    staleTime: 0,
    queryFn: async () => {
      const [procRes, sentRes] = await Promise.all([
        supabase.from("candidates").select("selected_by").eq("status", "processing").not("selected_by", "is", null),
        supabase.from("candidates").select("cv_sent_to").eq("status", "available").not("cv_sent_to", "is", null),
      ]);
      const procCounts: Record<string, number> = {};
      for (const r of procRes.data ?? []) { const k = r.selected_by!; procCounts[k] = (procCounts[k] ?? 0) + 1; }
      const procTotal = Object.values(procCounts).reduce((a, b) => a + b, 0);
      const sentCounts: Record<string, number> = {};
      for (const r of sentRes.data ?? []) { const k = r.cv_sent_to!; sentCounts[k] = (sentCounts[k] ?? 0) + 1; }
      return { procCounts, procTotal, sentCounts };
    },
  });

  const activeCountry = countries.find((c) => c.id === activeCountryId) ?? countries[0] ?? null;
  const activeOffices  = offices.filter((o) => o.country_id === activeCountry?.id);

  const { data: summaryCandidates = [] } = useQuery({
    queryKey: ["office-summary-candidates", user?.id],
    enabled: !!user && summaryView,
    staleTime: 0,
    queryFn: async () => {
      // Fetch all candidates with any CV activity — RLS scopes to manager's data
      const { data } = await supabase
        .from("candidates")
        .select("id, cv_sent_to, cv_resent_offices, selected_by")
        .or("cv_sent_to.not.is.null,cv_resent_offices.not.is.null,selected_by.not.is.null");
      return (data ?? []) as { id: string; cv_sent_to: string | null; cv_resent_offices: unknown; selected_by: string | null }[];
    },
  });

  const officeStats = useMemo(() => activeOffices.map(o => {
    const name = o.name;
    const sentTo    = summaryCandidates.filter(c => c.cv_sent_to === name);
    const pending   = sentTo.filter(c => !c.selected_by);
    const selected  = summaryCandidates.filter(c => c.selected_by === name);
    // Sent = unique candidates that are either currently sent or selected by this office
    const sentIds = new Set([...sentTo.map(c => c.id), ...selected.map(c => c.id)]);
    const resent = summaryCandidates.filter(c => {
      const arr = c.cv_resent_offices;
      return Array.isArray(arr) && (arr as string[]).includes(name);
    });
    return { name, sent: sentIds.size, selected: selected.length, pending: pending.length, resent: resent.length };
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

  const musanedSaved = !!credentials?.musanedEmail;
  const enjazSaved   = !!credentials?.enjazEmail;
  const mofaSaved    = !!credentials?.mofaEmail;
  const lmisSaved    = !!credentials?.lmisEmail;

  function openSetup(type: "musaned" | "enjaz" | "mofa" | "lmis") {
    if (type === "musaned") {
      setMusanedEmail(credentials?.musanedEmail ?? "");
      setMusanedPasswordDraft(credentials?.musanedPassword ?? "");
      setMusanedShowPassword(false);
    } else if (type === "enjaz") {
      setEnjazEmail(credentials?.enjazEmail ?? "");
      setEnjazPasswordDraft(credentials?.enjazPassword ?? "");
      setEnjazShowPassword(false);
    } else if (type === "mofa") {
      setMofaEmail(credentials?.mofaEmail ?? "");
      setMofaPasswordDraft(credentials?.mofaPassword ?? "");
      setMofaShowPassword(false);
    } else {
      setLmisEmail(credentials?.lmisEmail ?? "");
      setLmisPasswordDraft(credentials?.lmisPassword ?? "");
      setLmisShowPassword(false);
    }
    setActiveSetup(type);
  }

  const saveMusanedMut = useMutation({
    mutationFn: () => saveMusanedFn({ data: { email: musanedEmail.trim(), password: musanedPasswordDraft } }),
    onSuccess: () => {
      toast.success("Musaned credentials saved");
      qc.invalidateQueries({ queryKey: ["manager-credentials", user?.id] });
      setActiveSetup(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveEnjazMut = useMutation({
    mutationFn: () => saveEnjazFn({ data: { email: enjazEmail.trim(), password: enjazPasswordDraft } }),
    onSuccess: () => {
      toast.success("Enjaz+ credentials saved");
      qc.invalidateQueries({ queryKey: ["manager-credentials", user?.id] });
      setActiveSetup(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMofaMut = useMutation({
    mutationFn: () => saveMofaFn({ data: { email: mofaEmail.trim(), password: mofaPasswordDraft } }),
    onSuccess: () => {
      toast.success("MOFA credentials saved");
      qc.invalidateQueries({ queryKey: ["manager-credentials", user?.id] });
      setActiveSetup(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveLmisMut = useMutation({
    mutationFn: () => saveLmisFn({ data: { email: lmisEmail.trim(), password: lmisPasswordDraft } }),
    onSuccess: () => {
      toast.success("LMIS credentials saved");
      qc.invalidateQueries({ queryKey: ["manager-credentials", user?.id] });
      setActiveSetup(null);
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
    <div className="flex flex-col h-[calc(100vh-56px)] px-6 py-4 gap-4">

      {/* Title */}
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-base font-semibold tracking-tight">Assignments</h1>
        <p className="text-xs text-muted-foreground">Countries and offices appear in Processing filters.</p>
      </div>

      {/* ── Panel cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 shrink-0">
        <button type="button" onClick={() => setPanelDialog("countries")}
          className="border border-border bg-background flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left">
          <Globe className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Countries</div>
            <div className="text-xs text-muted-foreground">{countries.length} total</div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>

        <button type="button" onClick={() => setPanelDialog("offices")}
          className="border border-border bg-background flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left">
          <Building2 className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Offices</div>
            <div className="text-xs text-muted-foreground">
              {activeCountry ? `${activeOffices.length} in ${activeCountry.flag} ${activeCountry.name}` : `${offices.length} total`}
            </div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>

        <button type="button" onClick={() => setPanelDialog("cvTemplates")}
          className="border border-border bg-background flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">CV Templates</div>
            <div className="text-xs text-muted-foreground">{cvTemplates.length} uploaded</div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>

        <button type="button" onClick={() => setPanelDialog("cvReq")}
          className="border border-border bg-background flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left">
          <CircleDot className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">CV Page Requirements</div>
            <div className="text-xs text-muted-foreground">
              {Object.entries(cvReq).filter(([k, v]) => k !== "alert_after_days" && v !== "all").length} filters active
            </div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>

        <div className="border border-border bg-background flex items-center gap-3 px-4 py-3">
          <GraduationCap className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Training Centre (TC)</div>
            <div className="text-xs text-muted-foreground">
              {tcEnabled ? "Visible to staff" : "Hidden from staff"}
            </div>
          </div>
          <Switch
            checked={tcEnabled}
            disabled={updateTcEnabled.isPending}
            onCheckedChange={(v) => updateTcEnabled.mutate(v)}
          />
        </div>

        <button type="button" onClick={() => setPanelDialog("tcCriteria")}
          className="border border-border bg-background flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left">
          <ListChecks className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">TC Criteria</div>
            <div className="text-xs text-muted-foreground">{tcCriteriaKeys.length} of {ALL_TC_CRITERIA.length} active</div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>

        <button type="button" onClick={() => { setPanelDialog("cvDist"); setDistResult(null); }}
          className="border border-border bg-background flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left">
          <Shuffle className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">CV Distribution</div>
            <div className="text-xs text-muted-foreground">
              {offices.filter((o) => !(o as any).is_locked).length} active offices · resend after {cvDaysThreshold}d
            </div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </div>

      {/* ── Countries Dialog ──────────────────────────────────────────── */}
      <Dialog open={panelDialog === "countries"} onOpenChange={(o) => { if (!o) setPanelDialog(null); }}>
        <DialogContent className="sm:max-w-md rounded-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Countries
              <span className="ml-auto text-xs font-normal text-muted-foreground">{countries.length} total</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 overflow-y-auto max-h-[60vh]">
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
                <button key={c.id} type="button" onClick={() => { setActiveCountryId(c.id); setPanelDialog(null); }}
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
        </DialogContent>
      </Dialog>

      {/* ── Offices Dialog ────────────────────────────────────────────── */}
      <Dialog open={panelDialog === "offices"} onOpenChange={(o) => { if (!o) setPanelDialog(null); }}>
        <DialogContent className="sm:max-w-xl rounded-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Offices
              <span className="ml-auto text-xs font-normal text-muted-foreground shrink-0">{offices.length} total</span>
              {activeCountry && (
                <button type="button" onClick={() => setSummaryView(v => !v)}
                  className={cn("h-6 px-2 text-xs border flex items-center gap-1 rounded-none transition-colors shrink-0",
                    summaryView ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                  <BarChart3 className="h-3 w-3" /> Summary
                </button>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[65vh]">
            {countries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Globe className="h-7 w-7 mb-2 opacity-20" />
                <p className="text-sm">No countries yet. Add one in Countries.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {countries.map((c) => {
                  const cOffices = offices.filter((o) => o.country_id === c.id);
                  const isOpen   = activeCountryId === c.id;
                  return (
                    <div key={c.id}>
                      {/* Country header */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCountryId(isOpen ? null : c.id);
                          setSummaryView(false);
                          setNewOfficeName("");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/40 transition-colors text-left"
                      >
                        <span className="text-base leading-none">{c.flag}</span>
                        <span className="flex-1 text-sm font-semibold">{c.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {cOffices.length} {cOffices.length === 1 ? "office" : "offices"}
                        </span>
                        {isOpen
                          ? <ChevronRight className="h-3.5 w-3.5 text-primary rotate-90 transition-transform shrink-0" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0" />
                        }
                      </button>

                      {/* Expanded: offices + add form */}
                      {isOpen && (
                        <div className="bg-muted/20 border-t border-border/50 px-3 py-2 space-y-2">
                          {summaryView ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">{cOffices.length} offices</span>
                                <div className="flex items-center gap-3">
                                  <button type="button"
                                    onClick={() => qc.invalidateQueries({ queryKey: ["office-summary-candidates", user?.id] })}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                                    <RefreshCw className="h-3 w-3" /> Refresh
                                  </button>
                                  <button type="button" onClick={downloadOfficeCsv}
                                    className="flex items-center gap-1 text-xs text-primary hover:underline">
                                    <Download className="h-3 w-3" /> Export CSV
                                  </button>
                                </div>
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
                                    <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">No offices yet</td></tr>
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
                            <>
                              {/* Add office */}
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
                              {/* Office list */}
                              <div className="space-y-0.5">
                                {cOffices.length === 0 ? (
                                  <p className="text-sm text-muted-foreground text-center py-3">No offices yet.</p>
                                ) : officeSlice.map((o) => {
                                  const isLocked = (o as any).is_locked === true;
                                  return (
                                    <div key={o.id} className={cn("flex items-center gap-2 px-2 py-1.5 hover:bg-muted/40 group rounded-sm", isLocked && "opacity-60")}>
                                      {isLocked
                                        ? <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                        : <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      }
                                      <span className={cn("flex-1 truncate text-sm", isLocked && "line-through text-muted-foreground")}>{o.name}</span>
                                      {isLocked && (
                                        <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-sm shrink-0">Locked</span>
                                      )}
                                      <button type="button"
                                        title={isLocked ? "Unlock office" : "Lock office"}
                                        onClick={() => lockOfficeMut.mutate({ id: o.id, locked: !isLocked })}
                                        disabled={lockOfficeMut.isPending}
                                        className={cn("opacity-0 group-hover:opacity-100 transition-opacity", isLocked ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground hover:text-amber-500")}>
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
                              <Pager page={officePage} total={cOffices.length} set={setOfficePage} />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CV Templates Dialog ───────────────────────────────────────── */}
      <Dialog open={panelDialog === "cvTemplates"} onOpenChange={(o) => { if (!o) setPanelDialog(null); }}>
        <DialogContent className="sm:max-w-md rounded-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              CV Templates
              <span className="ml-auto text-xs font-normal text-muted-foreground">{cvTemplates.length} uploaded</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 overflow-y-auto max-h-[60vh]">
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
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(t.created_at).toLocaleDateString()}</span>
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
        </DialogContent>
      </Dialog>

      {/* ── CV Page Requirements Dialog ───────────────────────────────── */}
      <Dialog open={panelDialog === "cvReq"} onOpenChange={(o) => { if (!o) setPanelDialog(null); }}>
        <DialogContent className="sm:max-w-lg rounded-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleDot className="h-4 w-4 text-primary" />
              CV Page Requirements
              <Link to="/manager/candidates" search={{ tab: "available" }}
                className="ml-auto text-xs font-normal text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> View Qualifying
              </Link>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 overflow-y-auto max-h-[60vh]">
            <div className="flex items-center gap-2 px-3 py-1.5 border border-teal-200 bg-teal-50/40 dark:border-teal-800/40 dark:bg-teal-900/10">
              <Clock className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="text-sm text-muted-foreground w-24 shrink-0">Resend after</span>
              {cvDaysEdit ? (
                <div className="flex items-center gap-2 flex-1">
                  <input autoFocus type="number" min={1} value={cvDaysDraft}
                    onChange={(e) => setCvDaysDraft(e.target.value)}
                    className="w-14 border border-input rounded-none px-2 h-7 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { const n = parseInt(cvDaysDraft); if (!isNaN(n) && n > 0) updateThreshold.mutate(n); }
                      if (e.key === "Escape") setCvDaysEdit(false);
                    }} />
                  <span className="text-xs text-muted-foreground">days</span>
                  <Button size="sm" className="h-7 rounded-none px-2 text-xs" disabled={updateThreshold.isPending}
                    onClick={() => { const n = parseInt(cvDaysDraft); if (!isNaN(n) && n > 0) updateThreshold.mutate(n); }}>
                    {updateThreshold.isPending ? "…" : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 rounded-none px-2 text-xs" onClick={() => setCvDaysEdit(false)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-base font-bold text-teal-700 dark:text-teal-300">{cvDaysThreshold}</span>
                  <span className="text-xs text-muted-foreground">days</span>
                  <button type="button" className="ml-auto text-xs text-primary hover:underline"
                    onClick={() => { setCvDaysDraft(String(cvDaysThreshold)); setCvDaysEdit(true); }}>Edit</button>
                </div>
              )}
            </div>
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
                    onClick={() => { setAlertDraft(cvReq.alert_after_days); setAlertEdit(true); }}>Edit</button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 border border-blue-200 bg-blue-50/40 dark:border-blue-800/40 dark:bg-blue-900/10">
              <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-sm text-muted-foreground w-24 shrink-0">Base per office</span>
              {baseEdit ? (
                <div className="flex items-center gap-2 flex-1">
                  <input autoFocus type="number" min={1} value={baseDraft}
                    onChange={(e) => setBaseDraft(e.target.value)}
                    className="w-14 border border-input rounded-none px-2 h-7 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { const n = parseInt(baseDraft); if (!isNaN(n) && n > 0) { saveCvReq.mutate({ ...cvReq, base_per_office: String(n) }); setBaseEdit(false); } }
                      if (e.key === "Escape") setBaseEdit(false);
                    }} />
                  <span className="text-xs text-muted-foreground">candidates</span>
                  <Button size="sm" className="h-7 rounded-none px-2 text-xs" disabled={saveCvReq.isPending}
                    onClick={() => { const n = parseInt(baseDraft); if (!isNaN(n) && n > 0) { saveCvReq.mutate({ ...cvReq, base_per_office: String(n) }); setBaseEdit(false); } }}>
                    {saveCvReq.isPending ? "…" : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 rounded-none px-2 text-xs" onClick={() => setBaseEdit(false)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-base font-bold text-blue-700 dark:text-blue-300">{cvReq.base_per_office ?? "15"}</span>
                  <span className="text-xs text-muted-foreground">candidates</span>
                  <button type="button" className="ml-auto text-xs text-primary hover:underline"
                    onClick={() => { setBaseDraft(cvReq.base_per_office ?? "15"); setBaseEdit(true); }}>Edit</button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 border border-emerald-200 bg-emerald-50/40 dark:border-emerald-800/40 dark:bg-emerald-900/10">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-sm text-muted-foreground w-16 shrink-0">Status</span>
              <span className="flex-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">Available</span>
              <span className="text-xs text-muted-foreground">Locked</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-1">
              {(
                [
                  { key: "medical",         label: "Medical",         opts: MEDICAL_OPTIONS },
                  { key: "narrative",       label: "Narrative",       opts: narrativeOpts },
                  { key: "experience",      label: "Experience",      opts: EXPERIENCE_OPTIONS },
                  { key: "coc",             label: "COC",             opts: COC_OPTIONS },
                  { key: "passport_scan",   label: "Passport Scan",   opts: YES_NO_OPTIONS },
                  { key: "full_size_photo", label: "Full Size Photo", opts: YES_NO_OPTIONS },
                  { key: "photo_cv",        label: "Photo CV",        opts: YES_NO_OPTIONS },
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
        </DialogContent>
      </Dialog>

      {/* ── Row 3: Platform Credentials ──────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 shrink-0">
        {([
          { id: "musaned", label: "Musaned",  desc: "Staff HR Pool",  saved: musanedSaved },
          { id: "enjaz",   label: "Enjaz+",   desc: "Visa Portal",    saved: enjazSaved   },
          { id: "mofa",    label: "MOFA",     desc: "Visa Portal",    saved: mofaSaved    },
          { id: "lmis",    label: "LMIS",     desc: "Labour Market",  saved: lmisSaved    },
        ] as const).map(({ id, label, desc, saved }) => (
          <button key={id} type="button" onClick={() => openSetup(id)}
            className="border border-border bg-background flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left">
            <KeyRound className={cn("h-4 w-4 shrink-0", saved ? "text-emerald-500" : "text-primary")} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{label}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </div>
            {saved
              ? <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-sm shrink-0">Configured</span>
              : <span className="text-[10px] font-medium text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded-sm shrink-0">Not set</span>
            }
          </button>
        ))}
      </div>

      {/* ── LMIS Contract Process ─────────────────────────────────────── */}
      <div className="border border-border bg-background shrink-0">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
          <FileSignature className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">LMIS Contract Process</div>
            <div className="text-xs text-muted-foreground">3-phase contract workflow for processing candidates</div>
          </div>
          {!lmisSaved && (
            <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-sm shrink-0">
              LMIS credentials required
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 divide-x divide-border/60">

          {/* Phase 1 — Create Contract */}
          <div className="px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400 border border-sky-200 dark:border-sky-700 px-1.5 py-0.5 rounded-sm">Phase 1</span>
              <span className="text-xs font-semibold">Create Contract</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Logs into lmis.gov.et, goes to placed-labors, searches each processing candidate by Labour ID.
              <br />• Medical <strong>Not tested</strong> → sets LMIS status
              <br />• Medical <strong>Approved</strong> → creates contract → moves to Draft
            </p>
            {phase1Result && (
              <div className="text-[11px] space-y-0.5">
                <div className="text-muted-foreground">Last run:</div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-foreground font-medium">Checked {phase1Result.checked}</span>
                  <span className="text-zinc-500">·</span>
                  <span className="text-amber-700 dark:text-amber-400">{phase1Result.notTested} not-tested</span>
                  <span className="text-zinc-500">·</span>
                  <span className="text-violet-700 dark:text-violet-400">{phase1Result.draft} → draft</span>
                  {phase1Result.errors > 0 && (
                    <><span className="text-zinc-500">·</span><span className="text-red-600">{phase1Result.errors} errors</span></>
                  )}
                </div>
                <button type="button" onClick={() => setPhase1LogOpen(true)}
                  className="text-[10px] text-primary hover:underline">View log</button>
              </div>
            )}
            <Button
              size="sm"
              className="h-7 rounded-none px-3 text-xs gap-1.5 w-fit mt-auto"
              disabled={!lmisSaved || phase1Running}
              onClick={async () => {
                setPhase1Running(true);
                setPhase1Result(null);
                try {
                  const result = await runPhase1Fn();
                  setPhase1Result(result);
                  if (result.errors === 0) {
                    toast.success(`Phase 1 done — ${result.draft} moved to Draft, ${result.notTested} marked Not tested`);
                  } else {
                    toast.warning(`Phase 1 done with ${result.errors} error(s) — check the log`);
                  }
                } catch (e: any) {
                  toast.error(e.message ?? "Phase 1 failed");
                } finally {
                  setPhase1Running(false);
                }
              }}
            >
              {phase1Running ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Running…</>
              ) : (
                <><Play className="h-3 w-3" /> Run Phase 1</>
              )}
            </Button>
          </div>

          {/* Phase 2 — Draft */}
          <div className="px-4 py-3 flex flex-col gap-2 opacity-60">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 border border-violet-200 dark:border-violet-700 px-1.5 py-0.5 rounded-sm">Phase 2</span>
              <span className="text-xs font-semibold">Draft</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Continues the contract draft process on LMIS for candidates in Draft phase.
            </p>
            <Button
              size="sm"
              className="h-7 rounded-none px-3 text-xs gap-1.5 w-fit mt-auto"
              disabled
            >
              <Send className="h-3 w-3" /> Run Phase 2
            </Button>
          </div>

          {/* Phase 3 — Issue */}
          <div className="px-4 py-3 flex flex-col gap-2 opacity-60">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700 px-1.5 py-0.5 rounded-sm">Phase 3</span>
              <span className="text-xs font-semibold">Issue</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Issues the final contract on LMIS for candidates in Draft phase.
            </p>
            <Button
              size="sm"
              className="h-7 rounded-none px-3 text-xs gap-1.5 w-fit mt-auto"
              disabled
            >
              <CheckCircle2 className="h-3 w-3" /> Run Phase 3
            </Button>
          </div>
        </div>
      </div>

      {/* ── Musaned Fetch ─────────────────────────────────────────────── */}
      <div className="border border-border bg-background shrink-0">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
          <Globe className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Musaned Data Fetch</div>
            <div className="text-xs text-muted-foreground">Fetch visa & employer info for new Processing candidates from musaned.com.sa</div>
          </div>
          {!musanedSaved && (
            <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-sm shrink-0">
              Musaned credentials required
            </span>
          )}
        </div>
        <div className="px-4 py-3 flex flex-col gap-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Logs into musaned.com.sa, searches each <strong>new</strong> Processing candidate by passport number,
            and saves: Visa Number, Employer City, Employer Name, Employer Phone, House Number.
            <br />Only fetches candidates not yet fetched (runs automatically at 6:00 PM daily via Task Scheduler).
          </p>
          {musanedResult && (
            <div className="text-[11px] space-y-0.5">
              <div className="text-muted-foreground">Last run:</div>
              <div className="flex flex-wrap gap-2">
                <span className="text-foreground font-medium">{musanedResult.fetched} fetched</span>
                <span className="text-zinc-500">·</span>
                <span className="text-amber-700 dark:text-amber-400">{musanedResult.skipped} skipped</span>
                {musanedResult.errors > 0 && (
                  <><span className="text-zinc-500">·</span><span className="text-red-600">{musanedResult.errors} errors</span></>
                )}
              </div>
              <button type="button" onClick={() => setMusanedLogOpen(true)}
                className="text-[10px] text-primary hover:underline">View log</button>
            </div>
          )}
          <Button
            size="sm"
            className="h-7 rounded-none px-3 text-xs gap-1.5 w-fit mt-auto"
            disabled={!musanedSaved || musanedRunning}
            onClick={async () => {
              setMusanedRunning(true);
              setMusanedResult(null);
              try {
                const result = await runMusanedFn();
                setMusanedResult(result);
                if (result.errors === 0) {
                  toast.success(`Musaned fetch done — ${result.fetched} candidates updated`);
                } else {
                  toast.warning(`Musaned fetch done with ${result.errors} error(s) — check the log`);
                }
              } catch (e: any) {
                toast.error(e.message ?? "Musaned fetch failed");
              } finally {
                setMusanedRunning(false);
              }
            }}
          >
            {musanedRunning ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Fetching…</>
            ) : (
              <><Play className="h-3 w-3" /> Fetch Now</>
            )}
          </Button>
        </div>
      </div>

      {/* Musaned log dialog */}
      <Dialog open={musanedLogOpen} onOpenChange={setMusanedLogOpen}>
        <DialogContent className="sm:max-w-lg rounded-none">
          <DialogHeader>
            <DialogTitle className="text-sm">Musaned Fetch — Run Log</DialogTitle>
          </DialogHeader>
          <div className="bg-muted/50 border border-border rounded-none p-3 max-h-80 overflow-y-auto font-mono text-[11px] space-y-0.5">
            {musanedResult?.log.map((line, i) => (
              <div key={i} className={cn(
                "leading-relaxed",
                line.includes("ERROR") ? "text-red-600" :
                line.includes("Saved") ? "text-emerald-600 dark:text-emerald-400" :
                line.includes("skipping") || line.includes("skipped") ? "text-amber-600 dark:text-amber-400" :
                "text-muted-foreground"
              )}>{line}</div>
            ))}
          </div>
          {musanedResult && (
            <button
              type="button"
              className="text-xs text-primary hover:underline text-left"
              onClick={() => {
                const text = musanedResult.log.join("\n");
                const blob = new Blob([text], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = "musaned-fetch-log.txt";
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-3 w-3 inline mr-1" />Download log
            </button>
          )}
        </DialogContent>
      </Dialog>

      {/* Phase 1 log dialog */}
      <Dialog open={phase1LogOpen} onOpenChange={setPhase1LogOpen}>
        <DialogContent className="sm:max-w-lg rounded-none">
          <DialogHeader>
            <DialogTitle className="text-sm">Phase 1 — Run Log</DialogTitle>
          </DialogHeader>
          <div className="bg-muted/50 border border-border rounded-none p-3 max-h-80 overflow-y-auto font-mono text-[11px] space-y-0.5">
            {phase1Result?.log.map((line, i) => (
              <div key={i} className={cn(
                line.includes("ERROR") ? "text-red-600 dark:text-red-400" :
                line.includes("draft") || line.includes("Draft") ? "text-violet-700 dark:text-violet-400" :
                line.includes("Not tested") ? "text-amber-700 dark:text-amber-400" :
                "text-foreground"
              )}>{line}</div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── TC Criteria Dialog ───────────────────────────────────────── */}
      <Dialog open={panelDialog === "tcCriteria"} onOpenChange={(o) => { if (!o) setPanelDialog(null); }}>
        <DialogContent className="sm:max-w-md rounded-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              TC Criteria
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {tcCriteriaKeys.length}/{ALL_TC_CRITERIA.length} active
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 overflow-y-auto max-h-[60vh]">
            <p className="text-xs text-muted-foreground pb-1">
              Toggle which criteria count toward the "TC Ready" score on the Training Centre page.
            </p>
            {ALL_TC_CRITERIA.map((cr) => {
              const active = tcCriteriaKeys.includes(cr.key);
              return (
                <div key={cr.key} className="flex items-center gap-3 px-3 py-2 border border-border/50 hover:bg-muted/30 transition-colors">
                  <div className={cn(
                    "w-5 h-5 rounded-sm flex items-center justify-center text-[10px] font-bold shrink-0",
                    active ? "bg-emerald-500 text-white" : "bg-zinc-100 border border-zinc-300 text-zinc-400 dark:bg-zinc-800 dark:border-zinc-600",
                  )}>
                    {cr.short[0]}
                  </div>
                  <span className={cn("flex-1 text-sm", active ? "text-foreground" : "text-muted-foreground line-through")}>{cr.label}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = active
                        ? tcCriteriaKeys.filter((k) => k !== cr.key)
                        : [...tcCriteriaKeys, cr.key];
                      saveTcCriteriaMut.mutate(next);
                    }}
                    disabled={saveTcCriteriaMut.isPending}
                    className={cn(
                      "text-xs px-2 py-0.5 border rounded-sm font-medium transition-colors",
                      active
                        ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                        : "border-emerald-400/60 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20",
                    )}
                  >
                    {active ? "Remove" : "Add"}
                  </button>
                </div>
              );
            })}
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" className="h-7 rounded-none text-xs"
                disabled={tcCriteriaKeys.length === ALL_TC_CRITERIA.length || saveTcCriteriaMut.isPending}
                onClick={() => saveTcCriteriaMut.mutate(ALL_TC_CRITERIA_KEYS)}>
                Enable all
              </Button>
              <Button size="sm" variant="outline" className="h-7 rounded-none text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                disabled={tcCriteriaKeys.length === 0 || saveTcCriteriaMut.isPending}
                onClick={() => saveTcCriteriaMut.mutate([])}>
                Disable all
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CV Distribution Dialog ───────────────────────────────────── */}
      <Dialog open={panelDialog === "cvDist"} onOpenChange={(o) => { if (!o) setPanelDialog(null); }}>
        <DialogContent className="sm:max-w-md rounded-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shuffle className="h-4 w-4 text-primary" />
              CV Distribution
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Settings row */}
            <div className="flex items-center gap-3 text-[12px]">
              <div className="border border-border px-2.5 py-2 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Base per office</div>
                {baseEdit ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus type="number" min={1} value={baseDraft}
                      onChange={(e) => setBaseDraft(e.target.value)}
                      className="w-12 border border-input rounded-none px-1.5 h-6 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { const n = parseInt(baseDraft); if (!isNaN(n) && n > 0) { saveCvReq.mutate({ ...cvReq, base_per_office: String(n) }); setBaseEdit(false); } }
                        if (e.key === "Escape") setBaseEdit(false);
                      }}
                    />
                    <Button size="sm" className="h-6 rounded-none px-1.5 text-xs" disabled={saveCvReq.isPending}
                      onClick={() => { const n = parseInt(baseDraft); if (!isNaN(n) && n > 0) { saveCvReq.mutate({ ...cvReq, base_per_office: String(n) }); setBaseEdit(false); } }}>
                      {saveCvReq.isPending ? "…" : "Save"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 rounded-none px-1 text-xs" onClick={() => setBaseEdit(false)}>✕</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{cvReq.base_per_office}</span>
                    <button type="button" className="text-[10px] text-primary hover:underline"
                      onClick={() => { setBaseDraft(cvReq.base_per_office ?? "15"); setBaseEdit(true); }}>Edit</button>
                  </div>
                )}
              </div>
              <div className="border border-border px-2.5 py-2 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Auto-resend after</div>
                <span className="font-bold text-sm">{cvDaysThreshold} days</span>
              </div>
            </div>

            {/* Office breakdown table */}
            {(() => {
              const activeOfficList = offices.filter((o) => !(o as any).is_locked);
              const countryMap = new Map(countries.map((c) => [c.id, c]));
              const procTotal = cvDistStats?.procTotal ?? 0;
              if (activeOfficList.length === 0) return (
                <p className="text-[12px] text-muted-foreground text-center py-3">No active offices.</p>
              );
              return (
                <div className="border border-border overflow-hidden">
                  <div className="grid text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40 px-3 py-1.5"
                    style={{ gridTemplateColumns: "1fr auto auto auto" }}>
                    <span>Office</span>
                    <span className="text-right pr-4">Current CVs</span>
                    <span className="text-right pr-4">Base</span>
                    <span className="text-right">Overflow %</span>
                  </div>
                  <div className="divide-y divide-border max-h-48 overflow-y-auto">
                    {activeOfficList.map((o) => {
                      const country = countryMap.get(o.country_id ?? "");
                      const current = cvDistStats?.sentCounts?.[o.name] ?? 0;
                      const procCount = cvDistStats?.procCounts?.[o.name] ?? 0;
                      const pct = procTotal > 0 ? Math.round((procCount / procTotal) * 100) : null;
                      const afterResult = distResult?.byOffice?.[o.name];
                      return (
                        <div key={o.id} className="grid items-center px-3 py-1.5 text-[12px] hover:bg-muted/20"
                          style={{ gridTemplateColumns: "1fr auto auto auto" }}>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{o.name}</div>
                            {country && <div className="text-[10px] text-muted-foreground">{country.flag} {country.name}</div>}
                          </div>
                          <div className="text-right pr-4 tabular-nums">
                            {afterResult != null
                              ? <span className="font-semibold text-emerald-600 dark:text-emerald-400">{afterResult}</span>
                              : <span className="text-muted-foreground">{current}</span>}
                          </div>
                          <div className="text-right pr-4 tabular-nums text-muted-foreground">
                            {cvReq.base_per_office}
                          </div>
                          <div className="text-right tabular-nums">
                            {pct != null
                              ? <span className="text-primary font-medium">{pct}%</span>
                              : <span className="text-muted-foreground">—</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {distResult && (
                    <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border-t border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      {distResult.assigned} candidate{distResult.assigned !== 1 ? "s" : ""} distributed
                    </div>
                  )}
                </div>
              );
            })()}
            <Button
              className="w-full h-8 rounded-none gap-2 text-sm"
              disabled={distRunning}
              onClick={async () => {
                setDistRunning(true);
                setDistResult(null);
                try {
                  const r = await distributeFn();
                  setDistResult(r);
                  qc.invalidateQueries({ queryKey: ["cv-dist-stats", user?.id] });
                  qc.invalidateQueries({ queryKey: ["office-summary-candidates", user?.id] });
                  toast.success(`Distributed ${r.assigned} candidates across ${Object.keys(r.byOffice).length} offices`);
                } catch (e: any) {
                  toast.error(e.message ?? "Distribution failed");
                } finally {
                  setDistRunning(false);
                }
              }}
            >
              {distRunning ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Running…</>
              ) : (
                <><Shuffle className="h-4 w-4" /> Run Distribution</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Credential Dialog ─────────────────────────────────────────── */}
      <Dialog open={activeSetup !== null} onOpenChange={(open) => { if (!open) setActiveSetup(null); }}>
        <DialogContent className="sm:max-w-md rounded-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              {activeSetup === "musaned" ? "Musaned Setup"
                : activeSetup === "enjaz" ? "Enjaz+ Setup"
                : activeSetup === "lmis" ? "LMIS Setup"
                : "MOFA Setup"}
              {activeSetup === "lmis" ? (
                <a href="https://lmis.gov.et/" target="_blank" rel="noopener noreferrer"
                  className="ml-auto text-xs text-primary hover:underline flex items-center gap-1 font-normal">
                  <ExternalLink className="h-3 w-3" /> lmis.gov.et
                </a>
              ) : (
                <a
                  href={`https://www.google.com/search?q=${
                    activeSetup === "musaned" ? "musaned+tawtheeq+login"
                    : activeSetup === "enjaz" ? "enjaz+plus+portal+login"
                    : "MOFA+visa+saudi+login"
                  }`}
                  target="_blank" rel="noopener noreferrer"
                  className="ml-auto text-xs text-primary hover:underline flex items-center gap-1 font-normal">
                  <Search className="h-3 w-3" /> Find portal
                </a>
              )}
            </DialogTitle>
          </DialogHeader>

          {activeSetup === "musaned" && (
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-20 shrink-0">Email</span>
                <Input autoFocus className="h-8 rounded-none text-sm flex-1" type="email"
                  placeholder="Musaned email…"
                  value={musanedEmail} onChange={(e) => setMusanedEmail(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-20 shrink-0">Password</span>
                <div className="flex gap-1 flex-1">
                  <Input className="h-8 rounded-none text-sm flex-1"
                    type={musanedShowPassword ? "text" : "password"}
                    placeholder="Musaned password…"
                    value={musanedPasswordDraft} onChange={(e) => setMusanedPasswordDraft(e.target.value)} />
                  <button type="button" className="px-2 border border-input h-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setMusanedShowPassword((v) => !v)}>
                    {musanedShowPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="h-8 rounded-none px-4 text-sm"
                  disabled={!musanedEmail.trim() || !musanedPasswordDraft.trim() || saveMusanedMut.isPending}
                  onClick={() => saveMusanedMut.mutate()}>
                  {saveMusanedMut.isPending ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-none px-4 text-sm"
                  onClick={() => setActiveSetup(null)}>Cancel</Button>
              </div>
            </div>
          )}

          {activeSetup === "enjaz" && (
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-20 shrink-0">Email</span>
                <Input autoFocus className="h-8 rounded-none text-sm flex-1" type="email"
                  placeholder="Enjaz+ email…"
                  value={enjazEmail} onChange={(e) => setEnjazEmail(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-20 shrink-0">Password</span>
                <div className="flex gap-1 flex-1">
                  <Input className="h-8 rounded-none text-sm flex-1"
                    type={enjazShowPassword ? "text" : "password"}
                    placeholder="Enjaz+ password…"
                    value={enjazPasswordDraft} onChange={(e) => setEnjazPasswordDraft(e.target.value)} />
                  <button type="button" className="px-2 border border-input h-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setEnjazShowPassword((v) => !v)}>
                    {enjazShowPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="h-8 rounded-none px-4 text-sm"
                  disabled={!enjazEmail.trim() || !enjazPasswordDraft.trim() || saveEnjazMut.isPending}
                  onClick={() => saveEnjazMut.mutate()}>
                  {saveEnjazMut.isPending ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-none px-4 text-sm"
                  onClick={() => setActiveSetup(null)}>Cancel</Button>
              </div>
            </div>
          )}

          {activeSetup === "mofa" && (
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-20 shrink-0">Email</span>
                <Input autoFocus className="h-8 rounded-none text-sm flex-1" type="email"
                  placeholder="MOFA email…"
                  value={mofaEmail} onChange={(e) => setMofaEmail(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-20 shrink-0">Password</span>
                <div className="flex gap-1 flex-1">
                  <Input className="h-8 rounded-none text-sm flex-1"
                    type={mofaShowPassword ? "text" : "password"}
                    placeholder="MOFA password…"
                    value={mofaPasswordDraft} onChange={(e) => setMofaPasswordDraft(e.target.value)} />
                  <button type="button" className="px-2 border border-input h-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setMofaShowPassword((v) => !v)}>
                    {mofaShowPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="h-8 rounded-none px-4 text-sm"
                  disabled={!mofaEmail.trim() || !mofaPasswordDraft.trim() || saveMofaMut.isPending}
                  onClick={() => saveMofaMut.mutate()}>
                  {saveMofaMut.isPending ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-none px-4 text-sm"
                  onClick={() => setActiveSetup(null)}>Cancel</Button>
              </div>
            </div>
          )}

          {activeSetup === "lmis" && (
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-20 shrink-0">Username</span>
                <Input autoFocus className="h-8 rounded-none text-sm flex-1"
                  placeholder="LMIS username…"
                  value={lmisEmail} onChange={(e) => setLmisEmail(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-20 shrink-0">Password</span>
                <div className="flex gap-1 flex-1">
                  <Input className="h-8 rounded-none text-sm flex-1"
                    type={lmisShowPassword ? "text" : "password"}
                    placeholder="LMIS password…"
                    value={lmisPasswordDraft} onChange={(e) => setLmisPasswordDraft(e.target.value)} />
                  <button type="button" className="px-2 border border-input h-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setLmisShowPassword((v) => !v)}>
                    {lmisShowPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="h-8 rounded-none px-4 text-sm"
                  disabled={!lmisEmail.trim() || !lmisPasswordDraft.trim() || saveLmisMut.isPending}
                  onClick={() => saveLmisMut.mutate()}>
                  {saveLmisMut.isPending ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-none px-4 text-sm"
                  onClick={() => setActiveSetup(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
