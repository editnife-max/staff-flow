import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import type { Database } from "@/integrations/supabase/types";

type Candidate = Database["public"]["Tables"]["candidates"]["Row"];
type Status = Database["public"]["Enums"]["candidate_status"];

export const Route = createFileRoute("/_authenticated/manager/candidates")({
  head: () => ({ meta: [{ title: "Candidates — Staff-Flow" }] }),
  component: CandidatesPage,
});

const COLUMNS: { id: Status; title: string }[] = [
  { id: "available", title: "Available" },
  { id: "processing", title: "Processing" },
  { id: "arrived", title: "Arrived" },
  { id: "canceled", title: "Canceled" },
];

function DraggableCard({ candidate }: { candidate: Candidate }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: candidate.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-lg border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm">{candidate.full_name}</div>
        <StatusBadge status={candidate.status} className="text-[10px] px-1.5 py-0" />
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        {candidate.country ?? "—"} • {candidate.occupation ?? "—"}
      </div>
    </div>
  );
}

function Column({ id, title, candidates }: { id: Status; title: string; candidates: Candidate[] }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[270px] rounded-xl bg-muted/40 p-3 transition-colors ${isOver ? "bg-accent/10 ring-2 ring-accent" : ""}`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{candidates.length}</span>
      </div>
      <div className="space-y-2 min-h-[200px]">
        {candidates.map((c) => <DraggableCard key={c.id} candidate={c} />)}
      </div>
    </div>
  );
}

function CandidatesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", country: "", occupation: "", passport_number: "", age: "" });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: candidates = [] } = useQuery({
    queryKey: ["candidates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("candidates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("candidates").insert({
        manager_id: user!.id,
        full_name: form.full_name,
        country: form.country || null,
        occupation: form.occupation || null,
        passport_number: form.passport_number || null,
        age: form.age ? Number(form.age) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Candidate added");
      qc.invalidateQueries({ queryKey: ["candidates"] });
      setOpen(false);
      setForm({ full_name: "", country: "", occupation: "", passport_number: "", age: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("candidates").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidates"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const newStatus = e.over?.id as Status | undefined;
    if (!newStatus) return;
    const cand = candidates.find((c) => c.id === id);
    if (!cand || cand.status === newStatus) return;
    updateStatus.mutate({ id, status: newStatus });
  };

  return (
    <div>
      <PageHeader
        title="Candidate pipeline"
        description="Drag cards between columns to update status."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Add candidate</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add candidate</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2"><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
                <div className="space-y-2"><Label>Occupation</Label><Input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} /></div>
                <div className="space-y-2"><Label>Passport #</Label><Input value={form.passport_number} onChange={(e) => setForm({ ...form, passport_number: e.target.value })} /></div>
                <div className="space-y-2"><Label>Age</Label><Input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => create.mutate()} disabled={!form.full_name || create.isPending}>
                  {create.isPending ? "Adding..." : "Add"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {COLUMNS.map((col) => (
            <Column key={col.id} id={col.id} title={col.title} candidates={candidates.filter((c) => c.status === col.id)} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
