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
    <div className="space-y-3 px-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold tracking-tight">Subscription</h1>
        <p className="text-[11px] text-muted-foreground">Choose a plan and submit payment proof for approval.</p>
      </div>

      {/* ── Plans ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {PLANS.map((p) => (
          <button key={p.id} type="button" onClick={() => setPlan(p.id)}
            className={cn(
              "text-left border bg-background p-3 transition-colors",
              plan === p.id ? "border-primary bg-primary/5" : "border-border hover:border-border/80 hover:bg-muted/30",
            )}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">{p.name}</span>
              {plan === p.id && <Check className="h-3 w-3 text-primary" />}
            </div>
            <div className="text-base font-bold text-primary mb-2">{p.price}</div>
            <ul className="space-y-0.5">
              {p.features.map((f) => (
                <li key={f} className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <span className="text-primary/60">·</span>{f}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      {/* ── Submit form ───────────────────────────────────────────────────── */}
      <div className="border border-border bg-background">
        <div className="px-2.5 py-1.5 border-b flex items-center gap-1.5 bg-muted/30">
          <CreditCard className="h-3 w-3 text-primary shrink-0" />
          <span className="text-[11px] font-semibold">Submit Upgrade Request</span>
          <span className="ml-auto text-[10px] text-muted-foreground capitalize">{plan} plan selected</span>
        </div>
        <div className="p-3 space-y-2">
          {/* File upload */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-28 shrink-0">Payment screenshot</span>
            <label className={cn(
              "h-6 inline-flex items-center gap-1 px-2 border text-[11px] font-medium cursor-pointer transition-colors",
              file ? "border-primary/50 bg-primary/5 text-primary" : "border-input bg-background text-muted-foreground hover:bg-muted",
            )}>
              <Upload className="h-2.5 w-2.5" />
              {file ? (file.name.length > 20 ? file.name.slice(0, 18) + "…" : file.name) : "Choose image"}
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            {file && (
              <button type="button" className="text-[11px] text-destructive hover:underline"
                onClick={() => setFile(null)}>remove</button>
            )}
          </div>
          {/* Notes */}
          <div className="flex gap-2">
            <span className="text-[11px] text-muted-foreground w-28 shrink-0 pt-1">Notes (optional)</span>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="rounded-none text-xs flex-1 resize-none" placeholder="Any details…" />
          </div>
          <Button size="sm" className="h-7 rounded-none text-xs px-4"
            onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </div>

      {/* ── Request history ───────────────────────────────────────────────── */}
      {requests.length > 0 && (
        <div className="border border-border bg-background">
          <div className="px-2.5 py-1.5 border-b flex items-center gap-1.5 bg-muted/30">
            <span className="text-[11px] font-semibold">Your Requests</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{requests.length} total</span>
          </div>
          <div className="p-2 space-y-1.5">
            <div className="space-y-px">
              {reqSlice.map((r) => (
                <div key={r.id} className="flex items-center gap-2 px-2 py-0.5 hover:bg-muted/30">
                  <span className="text-[11px] font-medium capitalize flex-1">{r.plan} plan</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded-none border",
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
                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="text-[10px] text-muted-foreground">{reqPage + 1} / {reqPages}</span>
                <button type="button" onClick={() => setReqPage(reqPage + 1)} disabled={reqPage >= reqPages - 1}
                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
