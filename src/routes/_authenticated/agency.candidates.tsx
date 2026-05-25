import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/agency/candidates")({
  head: () => ({ meta: [{ title: "Candidates — Agency Portal" }] }),
  component: AgencyCandidatesPage,
});

type Candidate = {
  id: string;
  full_name: string;
  photo_url: string | null;
  occupation: string | null;
  country: string | null;
  gender: string | null;
  age: number | null;
  religion: string | null;
  marital_status: string | null;
  experience: string | null;
  education: string | null;
  english_level: string | null;
  arabic_level: string | null;
  medical_status: string | null;
  passport_status: string | null;
  coc_status: string | null;
  selected_by: string | null;
  cv_sent_to: string | null;
  status: string;
};

function AgencyCandidatesPage() {
  const [query, setQuery] = useState("");
  const [filterOccupation, setFilterOccupation] = useState("all");
  const [filterGender, setFilterGender] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterReligion, setFilterReligion] = useState("all");
  const [filterExperience, setFilterExperience] = useState("all");
  const [filterMarital, setFilterMarital] = useState("all");
  const [ageFrom, setAgeFrom] = useState("");
  const [ageTo, setAgeTo] = useState("");

  const { data: candidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ["agency-candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select(
          "id,full_name,photo_url,occupation,country,gender,age,religion,marital_status," +
          "experience,education,english_level,arabic_level,medical_status,passport_status," +
          "coc_status,selected_by,cv_sent_to,status"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Candidate[];
    },
  });

  const occupations   = [...new Set(candidates.map((c) => c.occupation).filter((v): v is string => !!v))].sort();
  const statuses      = [...new Set(candidates.map((c) => c.status).filter(Boolean))].sort();
  const religions     = [...new Set(candidates.map((c) => c.religion).filter((v): v is string => !!v))].sort();
  const experiences   = [...new Set(candidates.map((c) => c.experience).filter((v): v is string => !!v))].sort();
  const maritalOpts   = [...new Set(candidates.map((c) => c.marital_status).filter((v): v is string => !!v))].sort();

  const ageFromNum = ageFrom !== "" ? Number(ageFrom) : null;
  const ageToNum   = ageTo   !== "" ? Number(ageTo)   : null;

  const filtered = candidates.filter((c) => {
    if (query && !c.full_name.toLowerCase().includes(query.toLowerCase())) return false;
    if (filterOccupation !== "all" && c.occupation !== filterOccupation) return false;
    if (filterGender !== "all" && c.gender !== filterGender) return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (filterReligion !== "all" && c.religion !== filterReligion) return false;
    if (filterExperience !== "all" && c.experience !== filterExperience) return false;
    if (filterMarital !== "all" && c.marital_status !== filterMarital) return false;
    if (ageFromNum !== null && (c.age == null || c.age < ageFromNum)) return false;
    if (ageToNum   !== null && (c.age == null || c.age > ageToNum))   return false;
    return true;
  });

  const activeCount = [
    filterOccupation !== "all", filterGender !== "all", filterStatus !== "all",
    filterReligion !== "all", filterExperience !== "all", filterMarital !== "all",
    ageFrom !== "", ageTo !== "",
  ].filter(Boolean).length;

  function resetFilters() {
    setFilterOccupation("all"); setFilterGender("all"); setFilterStatus("all");
    setFilterReligion("all"); setFilterExperience("all"); setFilterMarital("all");
    setAgeFrom(""); setAgeTo(""); setQuery("");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Candidates"
        description={`${filtered.length} candidate${filtered.length !== 1 ? "s" : ""} sent to your agency`}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterOccupation} onValueChange={setFilterOccupation}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Occupation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All occupations</SelectItem>
            {occupations.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterGender} onValueChange={setFilterGender}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All genders</SelectItem>
            <SelectItem value="Female">Female</SelectItem>
            <SelectItem value="Male">Male</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterReligion} onValueChange={setFilterReligion}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Religion" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All religions</SelectItem>
            {religions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterExperience} onValueChange={setFilterExperience}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Experience" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All experience</SelectItem>
            {experiences.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterMarital} onValueChange={setFilterMarital}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Marital Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {maritalOpts.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Age range */}
        <Input
          type="number"
          placeholder="Age from"
          value={ageFrom}
          onChange={(e) => setAgeFrom(e.target.value)}
          className="w-24"
          min={0}
        />
        <Input
          type="number"
          placeholder="Age to"
          value={ageTo}
          onChange={(e) => setAgeTo(e.target.value)}
          className="w-24"
          min={0}
        />

        {activeCount > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs text-muted-foreground hover:text-foreground underline self-center"
          >
            Reset ({activeCount})
          </button>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="text-muted-foreground py-12 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-muted-foreground py-12 text-center">No candidates found.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c) => <AgencyCandidateCard key={c.id} candidate={c} />)}
        </div>
      )}
    </div>
  );
}

function AgencyCandidateCard({ candidate: c }: { candidate: Candidate }) {
  const rows: [string, string | number | null][] = [
    ["Occupation", c.occupation],
    ["Country", c.country],
    ["Age", c.age],
    ["Gender", c.gender],
    ["Religion", c.religion],
    ["Marital", c.marital_status],
    ["Experience", c.experience],
    ["Education", c.education],
    ["English", c.english_level],
    ["Arabic", c.arabic_level],
  ];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Photo header */}
        <div className="relative h-40 bg-muted flex items-center justify-center">
          {c.photo_url ? (
            <img src={c.photo_url} alt={c.full_name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-primary/10 grid place-items-center text-primary font-semibold text-xl">
              {c.full_name.charAt(0)}
            </div>
          )}
          <div className="absolute top-2 right-2">
            <StatusBadge status={c.status} />
          </div>
        </div>

        <div className="p-3 space-y-2">
          <p className="font-semibold text-sm truncate">{c.full_name}</p>

          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
            {rows.map(([label, val]) =>
              val != null ? (
                <div key={label} className="contents">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="truncate">{val}</span>
                </div>
              ) : null
            )}
          </div>

          <div className="flex flex-wrap gap-1 pt-1">
            {c.medical_status && <Badge variant="outline" className="text-xs">{c.medical_status}</Badge>}
            {c.coc_status && <Badge variant="outline" className="text-xs">COC: {c.coc_status}</Badge>}
            {c.passport_status && <Badge variant="outline" className="text-xs">PP: {c.passport_status}</Badge>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    available: "bg-success/15 text-success",
    processing: "bg-blue-500/15 text-blue-600",
    arrived: "bg-primary/15 text-primary",
    canceled: "bg-destructive/15 text-destructive",
    returned: "bg-orange-500/15 text-orange-600",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}
