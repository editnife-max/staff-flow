import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Palette, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteCustomCvTemplate,
  listCustomCvTemplates,
  saveCustomCvTemplate,
  setCustomCvTemplateActive,
  type CustomCvTemplate,
} from "@/lib/custom-cv.functions";
import { PRESETS } from "@/components/custom-cv/config";
import { CustomCvPreview } from "@/components/custom-cv/preview";
import { sampleCvData } from "@/components/custom-cv/sample";
import { TemplateEditor, type EditorTemplate } from "@/components/custom-cv/editor/template-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/manager/custom-cv")({
  head: () => ({ meta: [{ title: "Custom CV — Staff-Flow" }] }),
  component: CustomCvPage,
});

function CustomCvPage() {
  const [editing, setEditing] = useState<EditorTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  if (editing) {
    return (
      <div className="h-[calc(100vh-7.5rem)] min-h-[640px] bg-background">
        <TemplateEditor initial={editing} onClose={() => setEditing(null)} />
      </div>
    );
  }

  return (
    <>
      <TemplateList onEdit={(t) => setEditing(t)} onNew={() => setCreating(true)} />
      <NewTemplateDialog
        open={creating}
        onOpenChange={setCreating}
        onCreate={(t) => {
          setCreating(false);
          setEditing(t);
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

function TemplateList({
  onEdit,
  onNew,
}: {
  onEdit: (t: EditorTemplate) => void;
  onNew: () => void;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listCustomCvTemplates);
  const setActive = useServerFn(setCustomCvTemplateActive);
  const remove = useServerFn(deleteCustomCvTemplate);
  const save = useServerFn(saveCustomCvTemplate);
  const sample = useMemo(() => sampleCvData(), []);

  const { data, isLoading } = useQuery({
    queryKey: ["custom-cv-templates"],
    queryFn: () => list(),
  });
  const templates = data?.templates ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["custom-cv-templates"] });

  const activeMut = useMutation({
    mutationFn: (v: { id: string; isActive: boolean }) => setActive({ data: v }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Template deleted");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const duplicateMut = useMutation({
    mutationFn: (t: CustomCvTemplate) =>
      save({
        data: {
          id: null,
          name: `${t.name} (copy)`.slice(0, 60),
          isActive: false,
          config: t.config,
        },
      }),
    onSuccess: (t) => {
      toast.success(`Created “${t.name}”`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Palette className="h-6 w-6" /> Custom CV
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Design your company&apos;s own CV templates. Templates marked{" "}
            <span className="font-medium text-foreground">Available to staff</span> appear in
            &ldquo;Choose Download Type&rdquo; when your team downloads candidate CVs.
          </p>
        </div>
        <Button onClick={onNew} className="rounded-none">
          <Plus className="mr-1.5 h-4 w-4" /> New template
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border border-dashed border-border bg-background px-6 py-14 text-center">
          <Palette className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No custom templates yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Start from a preset, add your logo and contacts, choose the fields, and make it
            available to your staff.
          </p>
          <Button onClick={onNew} className="mt-1 rounded-none">
            <Plus className="mr-1.5 h-4 w-4" /> Create your first template
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {templates.map((t) => (
            <div key={t.id} className="flex flex-col border border-border bg-background">
              <button
                type="button"
                className="flex justify-center bg-muted/40 p-4"
                onClick={() =>
                  onEdit({ id: t.id, name: t.name, isActive: t.isActive, config: t.config })
                }
                aria-label={`Edit ${t.name}`}
              >
                <CustomCvPreview config={t.config} data={sample} width={200} />
              </button>
              <div className="flex flex-1 flex-col gap-3 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(t.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 rounded-none",
                      t.isActive ? "border-emerald-300 text-emerald-700" : "text-muted-foreground",
                    )}
                  >
                    {t.isActive ? "Staff can use" : "Hidden"}
                  </Badge>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={t.isActive}
                    disabled={activeMut.isPending}
                    onCheckedChange={(v) => activeMut.mutate({ id: t.id, isActive: v })}
                  />
                  Available to staff
                </label>
                <div className="mt-auto flex gap-1.5">
                  <Button
                    size="sm"
                    className="rounded-none"
                    onClick={() =>
                      onEdit({ id: t.id, name: t.name, isActive: t.isActive, config: t.config })
                    }
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-none"
                    disabled={duplicateMut.isPending}
                    onClick={() => duplicateMut.mutate(t)}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto rounded-none text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${t.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete “{t.name}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Staff will no longer be able to download CVs with it. This can&apos;t be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMut.mutate(t.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New template: pick a starting preset
// ---------------------------------------------------------------------------

function NewTemplateDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (t: EditorTemplate) => void;
}) {
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [name, setName] = useState("");
  const sample = useMemo(() => sampleCvData(), []);
  const presets = useMemo(() => PRESETS.map((p) => ({ ...p, cfg: p.config() })), []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl rounded-none">
        <DialogHeader>
          <DialogTitle>New Custom CV template</DialogTitle>
          <DialogDescription>
            Pick a starting point. You can change everything afterwards.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-5">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPresetId(p.id)}
              aria-pressed={presetId === p.id}
              className={cn(
                "flex flex-col items-center gap-2 border p-2 text-center",
                presetId === p.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <CustomCvPreview config={p.cfg} data={sample} width={140} />
              <span className="text-sm font-medium">{p.name}</span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                {p.description}
              </span>
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-name">Template name</Label>
          <Input
            id="new-name"
            value={name}
            maxLength={60}
            placeholder="e.g. Agency CV – Saudi"
            onChange={(e) => setName(e.target.value)}
            className="rounded-none"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-none" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="rounded-none"
            onClick={() => {
              const p = presets.find((x) => x.id === presetId)!;
              onCreate({
                id: null,
                name: name.trim() || p.name,
                isActive: true,
                config: p.config(),
              });
              setName("");
            }}
          >
            Start designing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
