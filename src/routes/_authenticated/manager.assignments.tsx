import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Trash2, Globe, Building2, ChevronRight, FileText, Upload, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
      setNewOfficeName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delOfficeMut = useMutation({
    mutationFn: (id: string) => delOfficeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Office removed");
      qc.invalidateQueries({ queryKey: ["assignment-offices"] });
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
    <div className="space-y-6 mx-[79.6px]">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Assign</h1>
        <p className="text-sm text-muted-foreground">
          Countries and offices here automatically appear in Processing filters.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* ── LEFT: Countries ──────────────────────────────────────────────── */}
        <Card className="rounded-none">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Countries
              <span className="ml-auto text-xs font-normal text-muted-foreground">{countries.length} total</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* Add form */}
            <div className="space-y-2">
              <Label className="text-xs">New Country</Label>
              <div className="flex gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-lg">{newCountryFlag}</span>
                  <select
                    value={newCountryFlag}
                    onChange={(e) => setNewCountryFlag(e.target.value)}
                    className="h-9 rounded-none border border-border bg-background text-sm px-1 focus:outline-none"
                  >
                    {COMMON_FLAGS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <Input
                  className="rounded-none h-9 flex-1"
                  placeholder="Country name…"
                  value={newCountryName}
                  onChange={(e) => setNewCountryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCountryName.trim()) addCountryMut.mutate();
                  }}
                />
                <Button
                  size="sm"
                  className="h-9 rounded-none gap-1"
                  disabled={!newCountryName.trim() || addCountryMut.isPending}
                  onClick={() => addCountryMut.mutate()}
                >
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </div>

            {/* Country list */}
            <div className="space-y-1">
              {countries.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No countries yet. Add one above.</p>
              ) : countries.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCountryId(c.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-none border text-left transition-colors group",
                    (activeCountry?.id === c.id)
                      ? "border-primary/40 bg-primary/5"
                      : "border-transparent hover:border-border hover:bg-muted/40",
                  )}
                >
                  <span className="text-base">{c.flag}</span>
                  <span className="flex-1 text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground mr-1">
                    {offices.filter((o) => o.country_id === c.id).length} offices
                  </span>
                  <ChevronRight className={cn(
                    "h-3.5 w-3.5 transition-colors",
                    activeCountry?.id === c.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                  )} />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); delCountryMut.mutate(c.id); }}
                    className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove country"
                    disabled={delCountryMut.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── RIGHT: Offices ───────────────────────────────────────────────── */}
        <Card className="rounded-none">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Offices
              {activeCountry ? (
                <span className="text-muted-foreground font-normal">
                  — {activeCountry.flag} {activeCountry.name}
                </span>
              ) : (
                <span className="text-muted-foreground font-normal text-xs">Select a country</span>
              )}
              {activeCountry && (
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {activeOffices.length} offices
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {!activeCountry ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <Globe className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm">Select a country on the left to manage its offices.</p>
              </div>
            ) : (
              <>
                {/* Add form */}
                <div className="space-y-2">
                  <Label className="text-xs">
                    New Office in {activeCountry.flag} {activeCountry.name}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      className="rounded-none h-9 flex-1"
                      placeholder="Office name…"
                      value={newOfficeName}
                      onChange={(e) => setNewOfficeName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newOfficeName.trim()) addOfficeMut.mutate();
                      }}
                    />
                    <Button
                      size="sm"
                      className="h-9 rounded-none gap-1"
                      disabled={!newOfficeName.trim() || addOfficeMut.isPending}
                      onClick={() => addOfficeMut.mutate()}
                    >
                      <Plus className="h-4 w-4" /> Add
                    </Button>
                  </div>
                </div>

                {/* Office list */}
                <div className="space-y-1">
                  {activeOffices.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      No offices for {activeCountry.name} yet.
                    </p>
                  ) : activeOffices.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-none border border-border/60 bg-muted/20 group"
                    >
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm">{o.name}</span>
                      <button
                        type="button"
                        onClick={() => delOfficeMut.mutate(o.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove office"
                        disabled={delOfficeMut.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── CV Templates ───────────────────────────────────────────────────── */}
      <Card className="rounded-none">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            CV Templates
            <span className="ml-auto text-xs font-normal text-muted-foreground">{cvTemplates.length} uploaded</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {/* Upload form */}
          <div className="space-y-2">
            <Label className="text-xs">Upload New Template</Label>
            <div className="flex gap-2">
              <Input
                className="rounded-none h-9 flex-1"
                placeholder="Template name…"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newTemplateName.trim() && templateFile) handleTemplateUpload(); }}
              />
              <label
                className={cn(
                  "h-9 rounded-none inline-flex items-center gap-1.5 px-3 border text-sm font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0",
                  templateFile
                    ? "border-primary/50 bg-primary/5 text-primary"
                    : "border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Upload className="h-3.5 w-3.5" />
                {templateFile ? templateFile.name.length > 18 ? templateFile.name.slice(0, 16) + "…" : templateFile.name : "Choose PDF"}
                <input
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={(e) => setTemplateFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <Button
                size="sm"
                className="h-9 rounded-none gap-1"
                disabled={!newTemplateName.trim() || !templateFile || templateUploading}
                onClick={handleTemplateUpload}
              >
                {templateUploading ? "Uploading…" : "Upload"}
              </Button>
            </div>
            {templateFile && (
              <p className="text-xs text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{templateFile.name}</span>
                <button type="button" className="ml-2 text-destructive hover:underline" onClick={() => setTemplateFile(null)}>remove</button>
              </p>
            )}
          </div>

          {/* Template list */}
          {cvTemplates.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No CV templates uploaded yet.</p>
          ) : (
            <div className="space-y-1">
              {cvTemplates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-none border border-border/60 bg-muted/20 group"
                >
                  <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="flex-1 text-sm font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString()}
                  </span>
                  <a
                    href={t.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title="View PDF"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => delTemplateMut.mutate(t.id)}
                    disabled={delTemplateMut.isPending}
                    className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove template"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info banner */}
      <div className="rounded-none border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        Countries and offices added here will instantly appear as selectable options in the{" "}
        <strong>Processing</strong> filters for both Manager and Staff views. Removing a country
        also removes all its offices. CV Templates uploaded here are available to staff in the{" "}
        <strong>CV Generator</strong>.
      </div>
    </div>
  );
}
