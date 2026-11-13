import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, CreditCard, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/manager/subscription")({
  head: () => ({ meta: [{ title: "Subscription — Staff-Flow" }] }),
  component: SubscriptionPage,
});

const PLANS = [
  { id: "basic",    name: "Basic",    price: "$29/mo",  features: ["Up to 50 candidates", "2 staff seats", "Email support"] },
  { id: "standard", name: "Standard", price: "$79/mo",  features: ["Up to 250 candidates", "10 staff seats", "Priority support"] },
  { id: "pro",      name: "Pro",      price: "$199/mo", features: ["Unlimited candidates", "Unlimited staff", "Dedicated manager"] },
] as const;

const PAGE = 3;

function SubscriptionPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [plan,  setPlan]  = useState<"basic" | "standard" | "pro">("standard");
  const [notes, setNotes] = useState("");
  const [file,  setFile]  = useState<File | null>(null);
  const [reqPage, setReqPage] = useState(0);

  const { data: requests = [] } = useQuery({
    queryKey: ["subscription_requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      let screenshot_url: string | null = null;
      if (file) {
        const path = `${user!.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, file);
        if (upErr) throw upErr;
        screenshot_url = path;
      }
      const { error } = await supabase.from("subscription_requests").insert({
        manager_id: user!.id, plan, notes: notes || null, screenshot_url,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request submitted for review");
      qc.invalidateQueries({ queryKey: ["subscription_requests"] });
      setNotes(""); setFile(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reqSlice = requests.slice(reqPage * PAGE, reqPage * PAGE + PAGE);
  const reqPages = Math.ceil(requests.length / PAGE);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-[28px]">Subscription</h1>
        <p className="text-sm text-muted-foreground">Choose a plan and submit payment proof for approval.</p>
      </div>

      {/* ── Plans ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PLANS.map((p) => (
          <button key={p.id} type="button" onClick={() => setPlan(p.id)}
            aria-pressed={plan === p.id}
            className={cn(
              "rounded-2xl border bg-card p-5 text-left shadow-xs transition-all",
              plan === p.id ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40",
            )}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">{p.name}</span>
              <span className={cn(
                "grid h-5 w-5 place-items-center rounded-full border",
                plan === p.id ? "border-primary bg-primary text-primary-foreground" : "border-border",
              )}>
                {plan === p.id && <Check className="h-3 w-3" />}
              </span>
            </div>
            <div className="mb-3 text-[28px] font-semibold leading-none tracking-tight">{p.price}</div>
            <ul className="space-y-1.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />{f}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      {/* ── Submit form ───────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <CreditCard className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold">Submit upgrade request</span>
          <span className="ml-auto text-xs capitalize text-muted-foreground">{plan} plan selected</span>
        </div>
        <div className="space-y-4 p-4">
          {/* File upload */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="w-36 shrink-0 text-sm text-muted-foreground">Payment screenshot</span>
            <label className={cn(
              "inline-flex h-9 w-fit cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
              file ? "border-primary/50 bg-primary/5 text-primary" : "border-input bg-background text-muted-foreground hover:bg-muted",
            )}>
              <Upload className="h-3.5 w-3.5" />
              {file ? (file.name.length > 20 ? file.name.slice(0, 18) + "…" : file.name) : "Choose image"}
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            {file && (
              <button type="button" className="w-fit text-sm text-destructive hover:underline"
                onClick={() => setFile(null)}>remove</button>
            )}
          </div>
          {/* Notes */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <span className="w-36 shrink-0 pt-1 text-sm text-muted-foreground">Notes (optional)</span>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="flex-1 resize-none text-sm" placeholder="Any details…" />
          </div>
          <Button className="h-10 w-full rounded-xl px-6 sm:w-auto"
            onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </div>

      {/* ── Request history ───────────────────────────────────────────────── */}
      {requests.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <span className="text-sm font-semibold">Your requests</span>
            <span className="ml-auto text-xs text-muted-foreground">{requests.length} total</span>
          </div>
          <div className="p-2 space-y-1.5">
            <div className="space-y-px">
              {reqSlice.map((r) => (
                <div key={r.id} className="flex items-center gap-2 px-2 py-0.5 hover:bg-muted/30">
                  <span className="flex-1 text-sm font-medium capitalize">{r.plan} plan</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                  <span className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
                    r.status === "approved"  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" :
                    r.status === "rejected"  ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400" :
                    "border-border bg-muted text-muted-foreground",
                  )}>{r.status}</span>
                </div>
              ))}
            </div>
            {reqPages > 1 && (
              <div className="flex items-center justify-between pt-1 border-t border-border/50">
                <button type="button" onClick={() => setReqPage(reqPage - 1)} disabled={reqPage === 0}
                  className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs text-muted-foreground">{reqPage + 1} / {reqPages}</span>
                <button type="button" onClick={() => setReqPage(reqPage + 1)} disabled={reqPage >= reqPages - 1}
                  className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
