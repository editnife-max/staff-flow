import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  Search, SlidersHorizontal, RotateCcw, ChevronDown, ChevronUp,
  ArrowUpDown, Users, User, BookOpen, Briefcase, Heart,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/agency/candidates")({
  head: () => ({ meta: [{ title: "Candidates — Agency Portal" }] }),
  component: AgencyCandidatesPage,
});

type Status = "available" | "processing" | "arrived" | "canceled" | "returned";

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


const STATUS_STYLES: Record<Status, string> = {
  available:  "bg-success text-success-foreground",
  processing: "bg-warning text-foreground",
  arrived:    "bg-info text-info-foreground",
  canceled:   "bg-destructive text-destructive-foreground",
  returned:   "bg-orange-500 text-white",
};

const initialFilters = {
  sort:       "newest",
  gender:     "all",
  religion:   "all",
  experience: "all",
  marital:    "all",
  ageFrom:    "",
  ageTo:      "",
};

function AgencyCandidatesPage() {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState(initialFilters);

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


  const ageFromNum = filters.ageFrom !== "" ? Number(filters.ageFrom) : null;
  const ageToNum   = filters.ageTo   !== "" ? Number(filters.ageTo)   : null;

  const filtered = candidates
    .filter((c) => !search || c.full_name.toLowerCase().includes(search.toLowerCase()))
    .filter((c) => filters.gender     === "all" || c.gender     === filters.gender)
    .filter((c) => filters.religion   === "all" || c.religion   === filters.religion)
    .filter((c) => filters.experience === "all" || c.experience === filters.experience)
    .filter((c) => filters.marital    === "all" || c.marital_status === filters.marital)
    .filter((c) => ageFromNum === null || (c.age != null && c.age >= ageFromNum))
    .filter((c) => ageToNum   === null || (c.age != null && c.age <= ageToNum))
    .sort((a, b) =>
      filters.sort === "oldest"
        ? (a as any).created_at?.localeCompare((b as any).created_at ?? "") ?? 0
        : ((b as any).created_at ?? "").localeCompare((a as any).created_at ?? "")
    );

  const activeCount = Object.entries(filters).filter(([k, v]) =>
    k !== "sort" && v && v !== "all"
  ).length;

  function resetFilters() {
    setFilters(initialFilters);
    setSearch("");
  }

  return (
    <div>
      <PageHeader
        title="Candidates"
        description={`${filtered.length} candidate${filtered.length !== 1 ? "s" : ""} sent to your agency`}
      />

      {/* Filter panel */}
      <Card className="rounded-none mb-0">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowFilters((s) => !s)}
                className="flex items-center gap-2 text-xs font-bold text-foreground hover:text-primary transition-colors"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                Filters
                {activeCount > 0 && (
                  <span className="rounded-none bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">
                    {activeCount}
                  </span>
                )}
                {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-7 text-xs rounded-none w-52"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              disabled={activeCount === 0 && !search}
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <FilterSelect
                value={filters.sort}
                onChange={(v) => setFilters({ ...filters, sort: v })}
                icon={ArrowUpDown}
                options={[
                  { value: "newest", label: "Newest first" },
                  { value: "oldest", label: "Oldest first" },
                ]}
              />
              <FilterSelect
                placeholder="Gender" value={filters.gender} icon={User}
                onChange={(v) => setFilters({ ...filters, gender: v })}
                options={[
                  { value: "all", label: "-----" },
                  { value: "Female", label: "Female" },
                  { value: "Male", label: "Male" },
                ]}
              />
              <FilterSelect
                placeholder="Religion" value={filters.religion} icon={BookOpen}
                onChange={(v) => setFilters({ ...filters, religion: v })}
                options={[
                  { value: "all",        label: "-----" },
                  { value: "Muslim",     label: "Muslim" },
                  { value: "Non-Muslim", label: "Non-Muslim" },
                ]}
              />
              <FilterSelect
                placeholder="Experience" value={filters.experience} icon={Briefcase}
                onChange={(v) => setFilters({ ...filters, experience: v })}
                options={[
                  { value: "all",            label: "-----" },
                  { value: "Experience",     label: "Experience" },
                  { value: "Non-Experience", label: "Non-Experience" },
                ]}
              />
              <FilterSelect
                placeholder="Marital Status" value={filters.marital} icon={Heart}
                onChange={(v) => setFilters({ ...filters, marital: v })}
                options={[
                  { value: "all",     label: "-----" },
                  { value: "Single",  label: "Single" },
                  { value: "Married", label: "Married" },
                ]}
              />
              {/* Age from / to */}
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="Age from"
                  value={filters.ageFrom}
                  onChange={(e) => setFilters({ ...filters, ageFrom: e.target.value })}
                  className="h-7 w-20 text-xs rounded-none"
                  min={0}
                />
                <span className="text-xs text-muted-foreground">–</span>
                <Input
                  type="number"
                  placeholder="Age to"
                  value={filters.ageTo}
                  onChange={(e) => setFilters({ ...filters, ageTo: e.target.value })}
                  className="h-7 w-20 text-xs rounded-none"
                  min={0}
                />
                {(filters.ageFrom || filters.ageTo) && (
                  <button
                    type="button"
                    onClick={() => setFilters({ ...filters, ageFrom: "", ageTo: "" })}
                    className="p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <Card className="rounded-none"><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card className="rounded-none"><CardContent className="p-8 text-center text-sm text-muted-foreground">No candidates found.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => <AgencyCandidateCard key={c.id} candidate={c} />)}
        </div>
      )}
    </div>
  );
}

function AgencyCandidateCard({ candidate: c }: { candidate: Candidate }) {
  const statusKey = (c.status in STATUS_STYLES ? c.status : "available") as Status;
  const STATUS_LABEL: Record<Status, string> = {
    available: "Available", processing: "Processing", arrived: "Arrived",
    canceled: "Canceled", returned: "Returned",
  };

  const fields: [string, string | number | null][] = [
    ["FULL NAME",     c.full_name],
    ["OCCUPATION",    c.occupation],
    ["COUNTRY",       c.country],
    ["AGE",           c.age],
    ["GENDER",        c.gender],
    ["RELIGION",      c.religion],
    ["MARITAL",       c.marital_status],
    ["EXPERIENCE",    c.experience],
    ["EDUCATION",     c.education],
    ["ENGLISH",       c.english_level],
    ["ARABIC",        c.arabic_level],
    ["MEDICAL",       c.medical_status],
    ["COC",           c.coc_status],
    ["PASSPORT",      c.passport_status],
  ];

  return (
    <Card className="relative overflow-visible transition-colors rounded-none mx-[5px]">
      <span className={cn(
        "absolute -top-2 left-3 rounded-none px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
        STATUS_STYLES[statusKey],
      )}>
        {STATUS_LABEL[statusKey]}
      </span>
      <CardContent className="p-0">
        <div className="grid grid-cols-[60px_1fr] gap-3 items-center">
          <div className="flex items-center justify-center">
            <Avatar className="h-10 w-10">
              {c.photo_url && <AvatarImage src={c.photo_url} alt={c.full_name} />}
              <AvatarFallback className="text-[10px]">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <div className="flex gap-5 items-start pt-[10px] pb-[10px] pr-[12px]">
              {fields.map(([label, val]) =>
                val != null ? (
                  <div key={label} className="shrink-0">
                    <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase whitespace-nowrap mb-[5px]">
                      {label}
                    </div>
                    <div className="text-[14px] text-[#181A27] whitespace-nowrap">
                      {val}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  value, onChange, options, placeholder, icon: Icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  icon?: React.ElementType;
}) {
  const isReset = value === "all" || !value;
  return (
    <div className="flex items-center gap-0.5">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className={cn(
            "border shadow-none w-auto h-7 px-2 gap-1.5 transition-colors rounded-none text-[13px] font-medium [&>svg]:shrink-0",
            isReset
              ? "bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              : "bg-black/10 border-black/20 text-[#181A27] dark:bg-white/10 dark:border-white/20 dark:text-white",
          )}
        >
          {Icon && <Icon className="h-3 w-3 shrink-0" />}
          {isReset ? <span>{placeholder}</span> : <SelectValue />}
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="py-1 px-2 focus:bg-muted/50">
              <span className={cn(
                "text-[13px]",
                o.value === "all" ? "text-muted-foreground" : "text-[#181A27] dark:text-white",
              )}>
                {o.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!isReset && (
        <button
          type="button"
          onClick={() => onChange("all")}
          className="rounded-none p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Clear filter"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
