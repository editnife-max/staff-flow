import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/_authenticated/manager/subscription")({
  head: () => ({ meta: [{ title: "Subscription — Staff-Flow" }] }),
  component: SubscriptionPage,
});

const PLANS = [
  { id: "basic", name: "Basic", price: "$29/mo", features: ["Up to 50 candidates", "2 staff seats", "Email support"] },
  { id: "standard", name: "Standard", price: "$79/mo", features: ["Up to 250 candidates", "10 staff seats", "Priority support"] },
  { id: "pro", name: "Pro", price: "$199/mo", features: ["Unlimited candidates", "Unlimited staff", "Dedicated manager"] },
] as const;

function SubscriptionPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [plan, setPlan] = useState<"basic" | "standard" | "pro">("standard");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: requests = [] } = useQuery({
    queryKey: ["subscription_requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("subscription_requests").select("*").order("created_at", { ascending: false });
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

  return (
    <div>
      <PageHeader title="Subscription" description="Choose a plan and submit your payment proof for approval." />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {PLANS.map((p) => (
          <Card
            key={p.id}
            className={`cursor-pointer transition ${plan === p.id ? "ring-2 ring-accent border-accent" : ""}`}
            onClick={() => setPlan(p.id)}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{p.name}</h3>
                {plan === p.id && <Check className="h-5 w-5 text-accent" />}
              </div>
              <div className="text-2xl font-bold mt-2">{p.price}</div>
              <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                {p.features.map((f) => <li key={f}>• {f}</li>)}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-2">
            <Label>Payment screenshot</Label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending ? "Submitting..." : "Submit upgrade request"}
          </Button>
        </CardContent>
      </Card>

      {requests.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Your requests</h2>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="rounded-lg border bg-card p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium capitalize">{r.plan} plan</div>
                  <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                </div>
                <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs uppercase tracking-wide">{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
