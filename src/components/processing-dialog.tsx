import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateCandidateProcessing } from "@/lib/candidates.functions";
import type { Database } from "@/integrations/supabase/types";

type Candidate = Database["public"]["Tables"]["candidates"]["Row"];

const MEDICAL = ["Fit", "Booked", "Unfit", "No", "In progress", "Expired"];
const COC = ["Done", "No", "Booked", "Placed", "Yitazez", "Pending release"];
const TASHEER = ["No", "Booked", "Done", "Ready"];
const WOKALA = ["Paid", "Unpaid"];
const VISA = [
  "Ready for embassy", "Sent to embassy", "Privately sent", "Issued",
  "Visa canceled", "Arrived KSA", "Returned", "Waiting replacement",
];
const INSURANCE = ["Yes", "No"];
const UNFILLED_LMIS = ["INSU", "COC", "ID"];
const LMIS = [
  "No COC", "Not tested", "Placed", "Imported", "Checked",
  "Verified", "Draft", "Pending", "Issued", "Rejected",
];
const TICKET = ["No", "Ready", "New order", "Booked", "Exchange", "Urgent"];
const ARRIVAL = ["Riyadh", "Jeddah", "Dammam", "Jouf", "Hail", "Abha", "Others"];

type FormState = {
  narrative: string;
  narrative_phone: string;
  contract_date: string;
  emergency_contact: string;
  medical_status: string;
  medical_date: string;
  medical_days: string;
  coc_status: string;
  tasheer_status: string;
  tasheer_date: string;
  wokala_status: string;
  embassy_date: string;
  visa_status: string;
  insurance_status: string;
  unfilled_lmis: string;
  lmis_status: string;
  ticket_status: string;
  ticket_date: string;
  arrival_city: string;
  processing_notes: string;
};

function init(c: Candidate | null): FormState {
  return {
    narrative: c?.narrative ?? "",
    narrative_phone: (c as any)?.narrative_phone ?? "",
    contract_date: (c as any)?.contract_date ?? "",
    emergency_contact: (c as any)?.emergency_contact ?? "",
    medical_status: c?.medical_status ?? "",
    medical_date: c?.medical_date ?? "",
    medical_days: (c as any)?.medical_days != null ? String((c as any).medical_days) : "",
    coc_status: c?.coc_status ?? "",
    tasheer_status: (c as any)?.tasheer_status ?? "",
    tasheer_date: (c as any)?.tasheer_date ?? "",
    wokala_status: (c as any)?.wokala_status ?? "",
    embassy_date: (c as any)?.embassy_date ?? "",
    visa_status: (c as any)?.visa_status ?? "",
    insurance_status: (c as any)?.insurance_status ?? "",
    unfilled_lmis: (c as any)?.unfilled_lmis ?? "",
    lmis_status: (c as any)?.lmis_status ?? "",
    ticket_status: (c as any)?.ticket_status ?? "",
    ticket_date: (c as any)?.ticket_date ?? "",
    arrival_city: (c as any)?.arrival_city ?? "",
    processing_notes: (c as any)?.processing_notes ?? "",
  };
}

export function ProcessingDialog({
  candidate, open, onOpenChange, invalidateKey,
}: {
  candidate: Candidate | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invalidateKey: readonly unknown[];
}) {
  const qc = useQueryClient();
  const update = useServerFn(updateCandidateProcessing);
  const [form, setForm] = useState<FormState>(init(candidate));

  useEffect(() => { if (open) setForm(init(candidate)); }, [open, candidate]);

  const save = useMutation({
    mutationFn: async () => {
      if (!candidate) return;
      const days = form.medical_days.trim();
      await update({
        data: {
          id: candidate.id,
          data: {
            narrative: form.narrative || null,
            narrative_phone: form.narrative_phone || null,
            contract_date: form.contract_date || null,
            emergency_contact: form.emergency_contact || null,
            medical_status: form.medical_status || null,
            medical_date: form.medical_date || null,
            medical_days: days === "" ? null : Number(days),
            coc_status: form.coc_status || null,
            tasheer_status: form.tasheer_status || null,
            tasheer_date: form.tasheer_date || null,
            wokala_status: form.wokala_status || null,
            embassy_date: form.embassy_date || null,
            visa_status: form.visa_status || null,
            insurance_status: form.insurance_status || null,
            unfilled_lmis: form.unfilled_lmis || null,
            lmis_status: form.lmis_status || null,
            ticket_status: form.ticket_status || null,
            ticket_date: form.ticket_date || null,
            arrival_city: form.arrival_city || null,
            processing_notes: form.processing_notes || null,
          },
        },
      });
    },
    onSuccess: () => {
      toast.success("Processing details saved");
      qc.invalidateQueries({ queryKey: invalidateKey });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Processing — {candidate?.full_name ?? "Candidate"}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-6">
          <Section title="📋 Basic">
            <TextField label="Narrative" value={form.narrative} onChange={(v) => set("narrative", v)} />
            <TextField label="Narrative Phone" value={form.narrative_phone} onChange={(v) => set("narrative_phone", v)} />
            <DateInput label="Contract Date" value={form.contract_date} onChange={(v) => set("contract_date", v)} />
            <TextField label="Emergency Contact" value={form.emergency_contact} onChange={(v) => set("emergency_contact", v)} />
          </Section>

          <Section title="🏥 Medical">
            <SelectField label="Medical Status" value={form.medical_status} options={MEDICAL} onChange={(v) => set("medical_status", v)} />
            <DateInput label="Medical Date" value={form.medical_date} onChange={(v) => set("medical_date", v)} />
            <TextField label="Medical Days" type="number" value={form.medical_days} onChange={(v) => set("medical_days", v)} />
          </Section>

          <Section title="📄 Documents">
            <SelectField label="COC" value={form.coc_status} options={COC} onChange={(v) => set("coc_status", v)} />
            <SelectField label="Tasheer" value={form.tasheer_status} options={TASHEER} onChange={(v) => set("tasheer_status", v)} />
            <DateInput label="Tasheer Date" value={form.tasheer_date} onChange={(v) => set("tasheer_date", v)} />
            <SelectField label="Wokala" value={form.wokala_status} options={WOKALA} onChange={(v) => set("wokala_status", v)} />
          </Section>

          <Section title="🏛️ Embassy & Visa">
            <DateInput label="Embassy Date" value={form.embassy_date} onChange={(v) => set("embassy_date", v)} />
            <SelectField label="Visa Status" value={form.visa_status} options={VISA} onChange={(v) => set("visa_status", v)} />
          </Section>

          <Section title="🛡️ Insurance & LMIS">
            <SelectField label="Insurance" value={form.insurance_status} options={INSURANCE} onChange={(v) => set("insurance_status", v)} />
            <SelectField label="Unfilled LMIS" value={form.unfilled_lmis} options={UNFILLED_LMIS} onChange={(v) => set("unfilled_lmis", v)} />
            <SelectField label="LMIS" value={form.lmis_status} options={LMIS} onChange={(v) => set("lmis_status", v)} />
          </Section>

          <Section title="✈️ Travel">
            <SelectField label="Ticket" value={form.ticket_status} options={TICKET} onChange={(v) => set("ticket_status", v)} />
            <DateInput label="Ticket Date" value={form.ticket_date} onChange={(v) => set("ticket_date", v)} />
            <SelectField label="Arrival City" value={form.arrival_city} options={ARRIVAL} onChange={(v) => set("arrival_city", v)} />
          </Section>

          <Section title="📝 Notes" cols={1}>
            <div className="space-y-2 col-span-full">
              <Label>Processing Notes</Label>
              <Textarea rows={3} value={form.processing_notes} onChange={(e) => set("processing_notes", e.target.value)} />
            </div>
          </Section>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!candidate || save.isPending}>
            {save.isPending ? "Saving..." : "Save processing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, cols = 3, children }: { title: string; cols?: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className={`grid gap-3 ${cols === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"}`}>
        {children}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <TextField label={label} value={value} onChange={onChange} type="date" />;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value || undefined} onValueChange={(v) => onChange(v === "__none" ? "" : v)}>
        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">—</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
