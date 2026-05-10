import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "./StatusPill";

interface Props {
  value: string | null | undefined;
  options: { value: string; label: string }[];
  onSave: (value: string) => Promise<void> | void;
  pill?: boolean;
}

export function EditableSelectCell({ value, options, onSave, pill = true }: Props) {
  return (
    <Select value={value ?? undefined} onValueChange={(v) => onSave(v)}>
      <SelectTrigger className="h-7 border-0 bg-transparent px-2 hover:bg-muted/60 focus:ring-1 focus:ring-ring [&>svg]:opacity-50">
        {pill ? (
          <StatusPill value={value ?? undefined} />
        ) : (
          <SelectValue placeholder="—" />
        )}
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
