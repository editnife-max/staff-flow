import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Clock, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { StatCard } from "@/components/stat-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/_authenticated/manager/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Staff-Flow" }] }),
  component: ManagerDashboard,
});

function ManagerDashboard() {
  const { user } = useAuth();
  const { data: candidates = [] } = useQuery({
    queryKey: ["candidates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const counts = {
    total: candidates.length,
    processing: candidates.filter((c) => c.status === "processing").length,
    arrived: candidates.filter((c) => c.status === "arrived").length,
    canceled: candidates.filter((c) => c.status === "canceled").length,
  };

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of your recruitment pipeline." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Candidates" value={counts.total} icon={Users} />
        <StatCard label="Processing" value={counts.processing} icon={Clock} tone="warning" />
        <StatCard label="Arrived" value={counts.arrived} icon={CheckCircle2} tone="info" />
        <StatCard label="Canceled" value={counts.canceled} icon={XCircle} tone="destructive" />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent candidates</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Occupation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.slice(0, 8).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.full_name}</TableCell>
                  <TableCell>{c.country ?? "—"}</TableCell>
                  <TableCell>{c.occupation ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {candidates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    No candidates yet. Add your first candidate from the Candidates page.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
