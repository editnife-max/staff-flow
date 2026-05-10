import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, X } from "lucide-react";
import { MEDICAL_OPTIONS, OFFICE_OPTIONS, STATUS_OPTIONS } from "./types";

interface Props {
  count: number;
  onClear: () => void;
  onBulkField: (field: "status" | "medical_status" | "office", value: string) => void;
  onBulkDelete: () => void;
  busy?: boolean;
}

export function BulkActionBar({ count, onClear, onBulkField, onBulkDelete, busy }: Props) {
  return (
    <div className="sticky top-2 z-30 flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 shadow-sm">
      <span className="text-sm font-semibold pl-1">{count} selected</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Select onValueChange={(v) => onBulkField("status", v)}>
          <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Set availability" /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select onValueChange={(v) => onBulkField("medical_status", v)}>
          <SelectTrigger className="h-8 w-[150px]"><SelectValue placeholder="Set medical" /></SelectTrigger>
          <SelectContent>
            {MEDICAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select onValueChange={(v) => onBulkField("office", v)}>
          <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="Set office" /></SelectTrigger>
          <SelectContent>
            {OFFICE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="destructive" disabled={busy} onClick={onBulkDelete} className="gap-1">
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear} className="gap-1">
          <X className="h-4 w-4" /> Clear
        </Button>
      </div>
    </div>
  );
}
