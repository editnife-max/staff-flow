import React, { useState } from "react";
import { Play } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, calcAge } from "@/lib/utils";
import type { Candidate, Status } from "./types";

export function CancelReasonDialog({
  onConfirm, onClose,
}: {
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("No sponsor");
  const [notes, setNotes] = useState("");
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Candidate</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="rounded-none h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["No sponsor", "Candidate withdrew", "Medical issue", "Visa rejected", "Document issue", "Other"].map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">NOTES</Label>
            <Textarea
              rows={2}
              placeholder="Optional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-none text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Back</Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(notes.trim() ? `${reason}: ${notes.trim()}` : reason)}
          >
            Confirm Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteReasonDialog({
  onConfirm, onClose,
}: {
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("No longer needed");
  const [notes, setNotes] = useState("");
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Request Deletion</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          The candidate won't be deleted immediately — the request will appear on the dashboard for confirmation.
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="rounded-none h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["No longer needed", "Duplicate record", "Candidate withdrew", "Data error", "Other"].map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              rows={2}
              placeholder="Optional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-none text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Back</Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(notes.trim() ? `${reason}: ${notes.trim()}` : reason)}
          >
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReturnReasonDialog({
  onConfirm, onClose,
}: {
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("Employer request");
  const [notes, setNotes] = useState("");
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark as Returned</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Return Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="rounded-none h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Employer request", "Medical condition", "Personal reasons", "Contract dispute", "Document issue", "Failed clearance", "Other"].map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">NOTES *</Label>
            <Textarea
              rows={3}
              placeholder="Describe the return reason in detail..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-none text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Back</Button>
          <Button
            className="bg-white0 hover:bg-orange-600 text-white"
            disabled={!notes.trim()}
            onClick={() => onConfirm(`${reason}: ${notes.trim()}`)}
          >
            Confirm Return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ArrivedCheckDialog({
  candidate, onArrived, onNotArrived, onClose,
}: {
  candidate: Candidate;
  onArrived: () => void;
  onNotArrived: (reason: string, problem: string) => void;
  onClose: () => void;
}) {
  const [notArrived, setNotArrived] = useState(false);
  const [reason, setReason] = useState("Visa issue");
  const [problem, setProblem] = useState("");
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Arrival Check — {candidate.full_name}</DialogTitle>
        </DialogHeader>
        {!notArrived ? (
          <>
            <p className="text-sm text-muted-foreground">
              The departure date{" "}
              <strong className="text-foreground">
                {candidate.ticket_date
                  ? new Date(candidate.ticket_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                  : ""}
              </strong>{" "}
              has passed. Did <strong className="text-foreground">{candidate.full_name}</strong> arrive?
            </p>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="ghost" className="sm:mr-auto" onClick={onClose}>Remind Later</Button>
              <Button variant="outline" onClick={() => setNotArrived(true)}>No — Not Arrived</Button>
              <Button onClick={onArrived}>Yes — Arrived</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="rounded-none h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Visa issue", "Flight issue", "Health issue", "Sponsor issue", "Other"].map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Problem Description</Label>
                <Textarea
                  rows={3}
                  placeholder="Describe the issue..."
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  className="rounded-none text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setNotArrived(false)}>Back</Button>
              <Button disabled={!problem.trim()} onClick={() => onNotArrived(reason, problem)}>
                Save & Stay in Processing
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CandidatePhotosDialog({ candidate, onClose }: { candidate: Candidate | null; onClose: () => void }) {
  if (!candidate) return null;
  const photos = [
    { label: "Photo", url: candidate.photo_url },
    { label: "Full Size Photo", url: (candidate as any).full_photo_url as string | null },
    { label: "Passport Scan", url: candidate.passport_scan_url },
  ].filter((p) => p.url);

  return (
    <Dialog open={!!candidate} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base">{candidate.full_name}</DialogTitle>
        </DialogHeader>
        {photos.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">No photos uploaded.</div>
        ) : (
          <div className="grid grid-cols-3 gap-4 py-2">
            {photos.map((p) => (
              <div key={p.label} className="flex flex-col items-center gap-2">
                <a href={p.url!} target="_blank" rel="noreferrer" className="block hover:opacity-80 transition-opacity">
                  <img src={p.url!} alt={p.label} className="w-full max-h-52 object-contain border border-border bg-muted/30" />
                </a>
                <span className="text-[11px] text-muted-foreground font-medium">{p.label}</span>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-[13px] text-foreground">{value || "—"}</span>
    </div>
  );
}

export function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">{title}</h3>
      <div className="grid grid-cols-3 gap-x-6 gap-y-3">{children}</div>
    </div>
  );
}

export function CandidateDetailDialog({ candidate, onClose, agencyPhones = {} }: { candidate: Candidate | null; onClose: () => void; agencyPhones?: Record<string, string> }) {
  if (!candidate) return null;
  const statusStyles: Record<Status, string> = {
    available: "bg-emerald-400 text-emerald-800",
    processing: "bg-amber-400 text-amber-800",
    arrived: "bg-blue-400 text-blue-800",
    canceled: "bg-red-400 text-red-800",
    returned: "bg-orange-400 text-orange-800",
  };
  const statusKey = (candidate.status as Status) ?? "available";

  return (
    <Dialog open={!!candidate} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{candidate.full_name}</span>
            {candidate.candidate_code && (
              <span className="text-xs font-mono font-normal text-muted-foreground">{candidate.candidate_code}</span>
            )}
            <span className={cn("ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-none capitalize", statusStyles[statusKey])}>
              {statusKey}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-5">
          {(candidate.photo_url || (candidate as any).full_photo_url || candidate.passport_scan_url) && (
            <div className="flex gap-3">
              {candidate.photo_url && (
                <div className="flex flex-col items-center gap-1">
                  <img src={candidate.photo_url} alt="Photo" className="h-24 w-20 object-cover border border-border" />
                  <span className="text-[10px] text-muted-foreground">Photo</span>
                </div>
              )}
              {(candidate as any).full_photo_url && (
                <div className="flex flex-col items-center gap-1">
                  <img src={(candidate as any).full_photo_url} alt="Full Photo" className="h-24 w-20 object-cover border border-border" />
                  <span className="text-[10px] text-muted-foreground">Full Photo</span>
                </div>
              )}
              {candidate.passport_scan_url && (
                <div className="flex flex-col items-center gap-1">
                  <img src={candidate.passport_scan_url} alt="Passport" className="h-24 w-20 object-cover border border-border" />
                  <span className="text-[10px] text-muted-foreground">Passport Scan</span>
                </div>
              )}
            </div>
          )}
          <DetailSection title="Personal">
            <InfoRow label="Full Name" value={candidate.full_name} />
            <InfoRow label="First Name" value={candidate.first_name} />
            <InfoRow label="Last Name" value={candidate.last_name} />
            <InfoRow label="Date of Birth" value={candidate.dob} />
            <InfoRow label="Age" value={calcAge(candidate.dob) ?? candidate.age} />
            <InfoRow label="Gender" value={candidate.gender} />
            <InfoRow label="Religion" value={candidate.religion} />
            <InfoRow label="Marital Status" value={candidate.marital_status} />
            <InfoRow label="Children" value={candidate.children} />
            <InfoRow label="Birth Place" value={candidate.birth_place} />
            <InfoRow label="Living Town" value={candidate.living_town} />
            <InfoRow label="Country" value={candidate.country} />
            <InfoRow label="Occupation" value={candidate.occupation} />
            <InfoRow label="Education" value={candidate.education} />
            <InfoRow label="Experience" value={candidate.experience === "None" ? "No" : candidate.experience} />
          </DetailSection>
          <DetailSection title="Passport">
            <InfoRow label="Passport Number" value={candidate.passport_number} />
            <InfoRow label="Passport Status" value={candidate.passport_status} />
            <InfoRow label="Issue Date" value={candidate.passport_issue_date} />
            <InfoRow label="Expiry Date" value={candidate.passport_expiry_date} />
            <InfoRow label="Place of Issue" value={candidate.place_of_issue} />
            <InfoRow label="Labour ID" value={candidate.labour_id} />
          </DetailSection>
          <DetailSection title="Languages & Physical">
            <InfoRow label="Spoken Languages" value={candidate.spoken_languages} />
            <InfoRow label="English Level" value={candidate.english_level} />
            <InfoRow label="Arabic Level" value={candidate.arabic_level} />
            <InfoRow label="Weight (kg)" value={candidate.weight} />
            <InfoRow label="Height (cm)" value={candidate.height} />
          </DetailSection>
          <DetailSection title="Status">
            <InfoRow label="Medical Status" value={candidate.medical_status} />
            <InfoRow label="Medical Date" value={candidate.medical_date} />
            {candidate.coc_status === "Placed" ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div><InfoRow label="COC Status" value={candidate.coc_status} /></div>
                  </TooltipTrigger>
                  <TooltipContent className="rounded-none text-xs p-2 space-y-0.5">
                    <div className="font-semibold">{(candidate as any).coc_agency_name || "—"}</div>
                    <div>{(candidate as any).coc_agency_phone || "No phone"}</div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <InfoRow label="COC Status" value={candidate.coc_status} />
            )}
            <InfoRow label="Country" value={candidate.musaned_status} />
            <InfoRow label="Passport Status" value={candidate.passport_status} />
            <InfoRow label="Office" value={candidate.office} />
            <InfoRow label="Selected By" value={candidate.selected_by} />
            <InfoRow label="Contract Date" value={candidate.contract_date} />
            <InfoRow label="CV Sent To" value={candidate.cv_sent_to} />
            <InfoRow label="CV Sent Date" value={candidate.cv_sent_date} />
            <InfoRow label="Narrative" value={candidate.narrative} />
            <InfoRow label="Narrative Phone" value={candidate.narrative_phone} />
          </DetailSection>
          <DetailSection title="Logistics & Processing">
            <InfoRow label="Tasheer Status" value={candidate.tasheer_status} />
            <InfoRow label="Tasheer Date" value={candidate.tasheer_date} />
            <InfoRow label="Wokala Status" value={candidate.wokala_status} />
            <InfoRow label="Visa Status" value={candidate.visa_status} />
            <InfoRow label="Ticket Status" value={candidate.ticket_status} />
            <InfoRow label="Ticket Date" value={candidate.ticket_date} />
            <InfoRow label="Arrival City" value={candidate.arrival_city} />
            <InfoRow label="LMIS Status" value={candidate.lmis_status} />
            <InfoRow label="Insurance" value={candidate.insurance_status} />
          </DetailSection>
          {(candidate.skills || candidate.notes || candidate.remark) && (
            <DetailSection title="Other">
              {candidate.skills && <div className="col-span-3"><InfoRow label="Skills" value={candidate.skills} /></div>}
              {candidate.notes && <div className="col-span-3"><InfoRow label="Notes" value={candidate.notes} /></div>}
              {candidate.remark && <div className="col-span-3"><InfoRow label="Remark" value={candidate.remark} /></div>}
            </DetailSection>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {candidate.video_url && (
            <Button variant="outline" className="gap-1.5" onClick={() => {
              const url = candidate.video_url!;
              const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
              window.open(gdMatch ? `https://drive.google.com/uc?export=download&id=${gdMatch[1]}` : url, "_blank");
            }}>
              <Play className="h-4 w-4" /> Video
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
