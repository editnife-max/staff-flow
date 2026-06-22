import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  Search, SlidersHorizontal, RotateCcw, ChevronDown, ChevronUp,
  ArrowUpDown, Users, User, BookOpen, Briefcase, Heart, Send,
  Play, Download, Eye, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, calcAge } from "@/lib/utils";
import { X } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { getStaffList, sendCandidatesNotification } from "@/lib/notifications.functions";
import { CvPreview, candidateToCanvas } from "@/components/cv-preview";
import { canvasToPdf } from "@/lib/pdf-export";

export const Route = createFileRoute("/_authenticated/agency/candidates")({
  head: () => ({ meta: [{ title: "Candidates — Agency Portal" }] }),
  component: AgencyCandidatesPage,
});

type Candidate = {
  id: string;
  full_name: string;
  photo_url: string | null;
  full_photo_url: string | null;
  passport_scan_url: string | null;
  video_url: string | null;
  occupation: string | null;
  country: string | null;
  gender: string | null;
  dob: string | null;
  age: number | null;
  religion: string | null;
  marital_status: string | null;
  children: number | null;
  birth_place: string | null;
  living_town: string | null;
  education: string | null;
  experience: string | null;
  experience_country: string | null;
  experience_years: string | null;
  english_level: string | null;
  arabic_level: string | null;
  spoken_languages: string | null;
  weight: number | null;
  height: number | null;
  skills: string | null;
  notes: string | null;
  remark: string | null;
  medical_status: string | null;
  passport_status: string | null;
  passport_number: string | null;
  passport_issue_date: string | null;
  passport_expiry_date: string | null;
  place_of_issue: string | null;
  labour_id: string | null;
  coc_status: string | null;
  selected_by: string | null;
  cv_sent_to: string | null;
  status: string;
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
  const [search, setSearch]           = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters]         = useState(initialFilters);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [sendOpen, setSendOpen]       = useState(false);
  const [staffId, setStaffId]         = useState("");
  const [message, setMessage]         = useState("");

  const fetchStaff = useServerFn(getStaffList);
  const doSend     = useServerFn(sendCandidatesNotification);

  const { data: candidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ["agency-candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select(
          "id,full_name,photo_url,full_photo_url,passport_scan_url,video_url," +
          "occupation,country,gender,dob,age,religion,marital_status,children," +
          "birth_place,living_town,education,experience,experience_country,experience_years," +
          "english_level,arabic_level,spoken_languages,weight,height,skills,notes,remark," +
          "medical_status,passport_status,passport_number,passport_issue_date," +
          "passport_expiry_date,place_of_issue,labour_id,coc_status," +
          "selected_by,cv_sent_to,status"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Candidate[];
    },
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-list"],
    queryFn: () => fetchStaff({}),
    enabled: sendOpen,
  });

  const ageFromNum = filters.ageFrom !== "" ? Number(filters.ageFrom) : null;
  const ageToNum   = filters.ageTo   !== "" ? Number(filters.ageTo)   : null;

  const filtered = candidates
    .filter((c) => !search || c.full_name.toLowerCase().includes(search.toLowerCase()))
    .filter((c) => filters.gender     === "all" || c.gender         === filters.gender)
    .filter((c) => filters.religion   === "all" || c.religion       === filters.religion)
    .filter((c) => filters.experience === "all" || c.experience     === filters.experience)
    .filter((c) => filters.marital    === "all" || c.marital_status === filters.marital)
    .filter((c) => ageFromNum === null || (c.age != null && c.age >= ageFromNum))
    .filter((c) => ageToNum   === null || (c.age != null && c.age <= ageToNum))
    .sort((a, b) =>
      filters.sort === "oldest"
        ? (a as any).created_at?.localeCompare((b as any).created_at ?? "") ?? 0
        : ((b as any).created_at ?? "").localeCompare((a as any).created_at ?? "")
    );

  const activeCount = Object.entries(filters).filter(([k, v]) => k !== "sort" && v && v !== "all").length;

  function resetFilters() { setFilters(initialFilters); setSearch(""); }

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((c) => c.id)));
  }

  function closeSend() { setSendOpen(false); setStaffId(""); setMessage(""); }

  const sendMut = useMutation({
    mutationFn: () => doSend({
      data: { staffUserId: staffId, candidateIds: [...selected], message: message || undefined },
    }),
    onSuccess: () => {
      toast.success(`${selected.size} candidate${selected.size !== 1 ? "s" : ""} sent to staff`);
      setSelected(new Set());
      closeSend();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Candidates"
        description={`${filtered.length} candidate${filtered.length !== 1 ? "s" : ""} sent to your agency`}
      />

      {/* Filter panel */}
      <Card className="rounded-none mb-3">
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
                value={filters.sort} onChange={(v) => setFilters({ ...filters, sort: v })}
                icon={ArrowUpDown}
                options={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }]}
              />
              <FilterSelect
                placeholder="Gender" value={filters.gender} icon={User}
                onChange={(v) => setFilters({ ...filters, gender: v })}
                options={[{ value: "all", label: "-----" }, { value: "Female", label: "Female" }, { value: "Male", label: "Male" }]}
              />
              <FilterSelect
                placeholder="Religion" value={filters.religion} icon={BookOpen}
                onChange={(v) => setFilters({ ...filters, religion: v })}
                options={[{ value: "all", label: "-----" }, { value: "Muslim", label: "Muslim" }, { value: "Non-Muslim", label: "Non-Muslim" }]}
              />
              <FilterSelect
                placeholder="Experience" value={filters.experience} icon={Briefcase}
                onChange={(v) => setFilters({ ...filters, experience: v })}
                options={[{ value: "all", label: "-----" }, { value: "Experience", label: "Experience" }, { value: "Non-Experience", label: "Non-Experience" }]}
              />
              <FilterSelect
                placeholder="Marital Status" value={filters.marital} icon={Heart}
                onChange={(v) => setFilters({ ...filters, marital: v })}
                options={[{ value: "all", label: "-----" }, { value: "Single", label: "Single" }, { value: "Married", label: "Married" }]}
              />
              <div className={cn(
                "flex items-center gap-1 h-7 px-2 border rounded-none text-[13px] font-medium transition-colors",
                (filters.ageFrom || filters.ageTo)
                  ? "bg-black/10 border-black/20 text-[#181A27] dark:bg-white/10 dark:border-white/20 dark:text-white"
                  : "bg-muted/40 border-border text-muted-foreground",
              )}>
                <Users className="h-3 w-3 shrink-0" />
                <input
                  type="number"
                  placeholder="Age from"
                  value={filters.ageFrom}
                  onChange={(e) => setFilters({ ...filters, ageFrom: e.target.value })}
                  className="w-14 bg-transparent outline-none text-xs placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  min={0}
                />
                <span className="text-muted-foreground">–</span>
                <input
                  type="number"
                  placeholder="Age to"
                  value={filters.ageTo}
                  onChange={(e) => setFilters({ ...filters, ageTo: e.target.value })}
                  className="w-14 bg-transparent outline-none text-xs placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  min={0}
                />
                {(filters.ageFrom || filters.ageTo) && (
                  <button type="button" onClick={() => setFilters({ ...filters, ageFrom: "", ageTo: "" })}
                    className="p-0.5 text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selection toolbar */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-3 mb-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <Checkbox
              checked={selected.size > 0 && selected.size === filtered.length}
              onCheckedChange={toggleAll}
              aria-label="Select all"
            />
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </label>
          {selected.size > 0 && (
            <>
              <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => setSendOpen(true)}>
                <Send className="h-3.5 w-3.5" />
                Send to Staff ({selected.size})
              </Button>
              <button type="button" onClick={() => setSelected(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground">
                Clear
              </button>
            </>
          )}
        </div>
      )}

      {/* Results grid */}
      {isLoading ? (
        <Card className="rounded-none">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">Loading…</CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="rounded-none">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">No candidates found.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
          {filtered.map((c) => (
            <AgencyCandidateCard
              key={c.id}
              candidate={c}
              selected={selected.has(c.id)}
              onToggle={() => toggleSelect(c.id)}
            />
          ))}
        </div>
      )}

      {/* Send to staff dialog */}
      <Dialog open={sendOpen} onOpenChange={(o) => { if (!o) closeSend(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Send to Staff</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Staff member</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff…" />
                </SelectTrigger>
                <SelectContent>
                  {staffList.length === 0
                    ? <SelectItem value="none" disabled>No staff available</SelectItem>
                    : staffList.map((s) => (
                        <SelectItem key={s.id} value={s.user_id}>{s.name}</SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                placeholder="Add a note for the staff member…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Sending {selected.size} candidate{selected.size !== 1 ? "s" : ""}.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeSend}>Cancel</Button>
            <Button onClick={() => sendMut.mutate()} disabled={!staffId || sendMut.isPending}>
              {sendMut.isPending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VideoPlayDialog({ url, onClose }: { url: string; onClose: () => void }) {
  const handleDownload = async () => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const ext = url.split("?")[0].split(".").pop() ?? "mp4";
      a.download = `video.${ext}`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl rounded-none">
        <DialogHeader>
          <DialogTitle className="text-base">Video</DialogTitle>
        </DialogHeader>
        <div className="relative w-full aspect-video bg-black overflow-hidden">
          <video src={url} controls autoPlay className="w-full h-full" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="outline" className="rounded-none gap-1 text-xs" onClick={handleDownload}>
            <Download className="h-3 w-3" /> Download Video
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CvViewDialog({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const canvas = await candidateToCanvas(candidate as any, null);
      await canvasToPdf(canvas, `${candidate.full_name} — CV.pdf`);
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>CV — {candidate.full_name}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[68vh] overflow-auto">
          <CvPreview candidate={candidate as any} template={null} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={handleDownload} disabled={downloading} className="gap-1.5">
            <Download className="h-4 w-4" />
            {downloading ? "Generating…" : "Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AgencyCandidateCard({
  candidate: c, selected, onToggle,
}: { candidate: Candidate; selected: boolean; onToggle: () => void }) {
  const [videoOpen, setVideoOpen] = useState(false);
  const [cvOpen, setCvOpen]       = useState(false);
  const [dlCv, setDlCv]           = useState(false);

  const age = calcAge(c.dob) ?? c.age;

  const handleDownloadCv = async () => {
    setDlCv(true);
    try {
      const canvas = await candidateToCanvas(c as any, null);
      await canvasToPdf(canvas, `${c.full_name} — CV.pdf`);
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setDlCv(false);
    }
  };

  const handleDownloadVideo = async () => {
    if (!c.video_url) return;
    try {
      const res = await fetch(c.video_url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const ext = c.video_url.split("?")[0].split(".").pop() ?? "mp4";
      a.download = `${c.full_name} — video.${ext}`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(c.video_url, "_blank");
    }
  };

  return (
    <>
      <div className={cn(
        "border border-border rounded-sm bg-card shadow-sm overflow-hidden flex flex-col transition-colors",
        selected && "ring-2 ring-primary/60",
      )}>
        {/* Square passport-size photo */}
        <div className="relative aspect-square bg-muted overflow-hidden">
          {c.photo_url ? (
            <img
              src={c.photo_url}
              alt={c.full_name}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
              <User className="h-10 w-10" />
            </div>
          )}
          <div className="absolute top-1 left-1">
            <Checkbox
              checked={selected}
              onCheckedChange={onToggle}
              aria-label="Select candidate"
              className="h-3.5 w-3.5 bg-white/90 border-white/80 shadow data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
          </div>
          <div className="absolute top-1 right-1">
            <StatusBadge status={c.status} />
          </div>
        </div>

        {/* Candidate info */}
        <div className="p-2 space-y-1 flex-1">
          <div className="font-semibold text-xs leading-tight line-clamp-2">{c.full_name}</div>
          <div className="space-y-0.5 text-[10px]">
            <div className="flex items-baseline gap-1">
              <span className="font-medium text-muted-foreground w-12 shrink-0">Age</span>
              <span className="text-foreground">{age ?? "—"}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-medium text-muted-foreground w-12 shrink-0">Religion</span>
              <span className="text-foreground truncate">{c.religion ?? "—"}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-medium text-muted-foreground w-12 shrink-0">Exp.</span>
              <span className="text-foreground truncate">{c.experience ?? "—"}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-2 pb-2 space-y-1">
          <div className="grid grid-cols-2 gap-0.5">
            <Button
              size="sm" variant="outline"
              className="h-6 text-[10px] gap-0.5 rounded-sm px-1"
              onClick={() => setCvOpen(true)}
            >
              <Eye className="h-2.5 w-2.5 shrink-0" /> View CV
            </Button>
            <Button
              size="sm" variant="outline"
              className="h-6 text-[10px] gap-0.5 rounded-sm px-1"
              onClick={handleDownloadCv}
              disabled={dlCv}
            >
              <FileText className="h-2.5 w-2.5 shrink-0" />
              {dlCv ? "…" : "CV PDF"}
            </Button>
          </div>
          {c.video_url ? (
            <div className="grid grid-cols-2 gap-0.5">
              <Button
                size="sm" variant="outline"
                className="h-6 text-[10px] gap-0.5 rounded-sm px-1"
                onClick={() => setVideoOpen(true)}
              >
                <Play className="h-2.5 w-2.5 shrink-0 fill-current" /> Play
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-6 text-[10px] gap-0.5 rounded-sm px-1"
                onClick={handleDownloadVideo}
              >
                <Download className="h-2.5 w-2.5 shrink-0" /> Video
              </Button>
            </div>
          ) : (
            <div className="h-6 flex items-center justify-center text-[9px] text-muted-foreground/40 border border-dashed border-border rounded-sm">
              No video
            </div>
          )}
        </div>
      </div>

      {videoOpen && <VideoPlayDialog url={c.video_url!} onClose={() => setVideoOpen(false)} />}
      {cvOpen && <CvViewDialog candidate={c} onClose={() => setCvOpen(false)} />}
    </>
  );
}

function FilterSelect({
  value, onChange, options, placeholder, icon: Icon,
}: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string; icon?: React.ElementType;
}) {
  const isReset = value === "all" || !value;
  return (
    <div className="flex items-center gap-0.5">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cn(
          "border shadow-none w-auto h-7 px-2 gap-1.5 transition-colors rounded-none text-[13px] font-medium [&>svg]:shrink-0",
          isReset
            ? "bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            : "bg-black/10 border-black/20 text-[#181A27] dark:bg-white/10 dark:border-white/20 dark:text-white",
        )}>
          {Icon && <Icon className="h-3 w-3 shrink-0" />}
          {isReset ? <span>{placeholder}</span> : <SelectValue />}
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="py-1 px-2 focus:bg-muted/50">
              <span className={cn("text-[13px]", o.value === "all" ? "text-muted-foreground" : "text-[#181A27] dark:text-white")}>
                {o.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!isReset && (
        <button type="button" onClick={() => onChange("all")}
          className="rounded-none p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Clear filter">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
