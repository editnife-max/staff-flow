import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeft, CheckCircle2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Candidate } from "@/lib/docx-fill";
import { saveCustomCvTemplate, type CustomCvTemplate } from "@/lib/custom-cv.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { CustomCvConfig } from "../config";
import { CustomCvPreview } from "../preview";
import { candidateCvData, sampleCvData } from "../sample";
import { ContactsPanel } from "./contacts-panel";
import { HeaderPanel } from "./header-panel";
import { LayoutPanel } from "./layout-panel";
import { SectionsPanel } from "./sections-panel";
import { StylePanel } from "./style-panel";
import type { Update } from "./types";

export interface EditorTemplate {
  id: string | null;
  name: string;
  isActive: boolean;
  config: CustomCvConfig;
}

const SAMPLE_ID = "__sample";

/** Width of an element, kept up to date. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function TemplateEditor({
  initial,
  onClose,
}: {
  initial: EditorTemplate;
  onClose: (saved?: CustomCvTemplate) => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(saveCustomCvTemplate);
  const [id, setId] = useState(initial.id);
  const [name, setName] = useState(initial.name);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [config, setConfig] = useState<CustomCvConfig>(initial.config);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify({ n: initial.name, a: initial.isActive, c: initial.config }),
  );
  const [overflow, setOverflow] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [candidateId, setCandidateId] = useState(SAMPLE_ID);
  const [previewRef, previewWidth] = useWidth<HTMLDivElement>();

  const dirty = JSON.stringify({ n: name, a: isActive, c: config }) !== savedSnapshot;
  const update: Update = (fn) => setConfig((c) => fn(c));

  // Recent candidates to preview with real data (the manager's own, via RLS).
  const { data: candidates = [] } = useQuery({
    queryKey: ["custom-cv-preview-candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data as Candidate[];
    },
    staleTime: 5 * 60_000,
  });
  const data = useMemo(() => {
    const c = candidates.find((x) => x.id === candidateId);
    return c ? candidateCvData(c) : sampleCvData();
  }, [candidates, candidateId]);

  const saveMut = useMutation({
    mutationFn: () =>
      save({ data: { id, name: name.trim() || "Untitled template", isActive, config } }),
    onSuccess: (saved) => {
      setId(saved.id);
      setName(saved.name);
      setConfig(saved.config);
      setSavedSnapshot(JSON.stringify({ n: saved.name, a: saved.isActive, c: saved.config }));
      qc.invalidateQueries({ queryKey: ["custom-cv-templates"] });
      toast.success("Template saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const previewW = Math.max(260, Math.min(previewWidth, 640));

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top bar */}
      <div className="glass-bar sticky top-14 z-30 flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 lg:static">
        <Button
          variant="ghost"
          size="sm"
         
          onClick={() => (dirty ? setConfirmLeave(true) : onClose())}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Templates
        </Button>
        <Input
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name"
          className="h-9 min-w-0 flex-1 font-medium sm:w-64 sm:flex-none"
          aria-label="Template name"
        />
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          Available to staff
        </label>
        <div className="ml-auto flex items-center gap-3">
          {overflow ? (
            <span
              className="flex items-center gap-1.5 text-xs font-medium text-amber-600"
              role="status"
            >
              <AlertTriangle className="h-4 w-4" /> Some content doesn&apos;t fit the page
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600" role="status">
              <CheckCircle2 className="h-4 w-4" /> Fits on one page
            </span>
          )}
          <Button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || (!dirty && !!id)}
           
          >
            <Save className="mr-1.5 h-4 w-4" />
            {saveMut.isPending ? "Saving…" : dirty || !id ? "Save" : "Saved"}
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[440px_1fr]">
        {/* Settings */}
        <Tabs defaultValue="layout" className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <TabsList className="h-auto w-full shrink-0 flex-wrap justify-start gap-0.5 border-b border-border bg-muted/40 p-1">
            {[
              ["layout", "Layout"],
              ["header", "Header"],
              ["sections", "Sections & fields"],
              ["contacts", "Contacts & footer"],
              ["style", "Style"],
            ].map(([v, label]) => (
              <TabsTrigger key={v} value={v} className="text-xs">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <TabsContent value="layout" className="mt-0">
              <LayoutPanel config={config} update={update} />
            </TabsContent>
            <TabsContent value="header" className="mt-0">
              <HeaderPanel config={config} update={update} />
            </TabsContent>
            <TabsContent value="sections" className="mt-0">
              <SectionsPanel config={config} update={update} />
            </TabsContent>
            <TabsContent value="contacts" className="mt-0">
              <ContactsPanel config={config} update={update} />
            </TabsContent>
            <TabsContent value="style" className="mt-0">
              <StylePanel config={config} update={update} />
            </TabsContent>
          </div>
        </Tabs>

        {/* Preview */}
        <div className="flex min-h-0 flex-col bg-muted/30">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground">Live preview · A4</span>
            <Select value={candidateId} onValueChange={setCandidateId}>
              <SelectTrigger
                className="h-8 w-44 text-xs sm:w-64"
                aria-label="Preview with candidate"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SAMPLE_ID} className="text-xs">
                  Sample candidate
                </SelectItem>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div ref={previewRef} className="mx-auto w-full max-w-[640px]">
              {previewWidth > 0 && (
                <CustomCvPreview
                  config={config}
                  data={data}
                  width={previewW}
                  onOverflow={setOverflow}
                />
              )}
            </div>
            {overflow && (
              <p className="mx-auto mt-3 max-w-[640px] text-xs text-amber-700">
                Content that doesn&apos;t fit is cut off. Hide some fields, move a section to the
                other column, choose Compact spacing or a smaller text size.
              </p>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              Your changes to “{name || "this template"}” will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => onClose()}>Discard changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
