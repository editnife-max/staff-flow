import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Columns3 } from "lucide-react";
import { COLUMNS, DEFAULT_VISIBLE, type ColumnKey } from "./types";

interface Props {
  visible: ColumnKey[];
  onChange: (next: ColumnKey[]) => void;
}

export function ColumnVisibilityMenu({ visible, onChange }: Props) {
  const set = new Set(visible);
  const toggle = (key: ColumnKey) => {
    const n = new Set(set);
    n.has(key) ? n.delete(key) : n.add(key);
    onChange(COLUMNS.map((c) => c.key).filter((k) => n.has(k)));
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Columns3 className="h-4 w-4" /> Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-h-[400px] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Visible columns</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex gap-1 px-2 py-1">
          <Button variant="ghost" size="sm" className="h-7 flex-1 text-xs"
            onClick={() => onChange(COLUMNS.map((c) => c.key))}>Show all</Button>
          <Button variant="ghost" size="sm" className="h-7 flex-1 text-xs"
            onClick={() => onChange([...DEFAULT_VISIBLE])}>Reset</Button>
        </div>
        <DropdownMenuSeparator />
        {COLUMNS.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.key}
            checked={set.has(c.key)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => toggle(c.key)}
          >
            {c.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function useColumnPreferences() {
  if (typeof window === "undefined") return { visible: DEFAULT_VISIBLE, set: () => {} };
  return { visible: DEFAULT_VISIBLE, set: () => {} };
}

export { Checkbox };
