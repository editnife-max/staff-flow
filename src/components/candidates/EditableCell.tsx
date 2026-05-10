import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  value: string | number | null | undefined;
  type?: "text" | "number" | "date";
  onSave: (value: string | number | null) => Promise<void> | void;
  className?: string;
  placeholder?: string;
}

export function EditableCell({ value, type = "text", onSave, className, placeholder }: Props) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState<string>(value == null ? "" : String(value));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setLocal(value == null ? "" : String(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    const original = value == null ? "" : String(value);
    if (local === original) return;
    let next: string | number | null = local.trim() === "" ? null : local;
    if (next != null && type === "number") {
      const n = Number(next);
      if (Number.isNaN(n)) return;
      next = n;
    }
    await onSave(next);
  };

  if (editing) {
    return (
      <Input
        ref={ref}
        type={type}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") { setLocal(value == null ? "" : String(value)); setEditing(false); }
        }}
        className="h-7 px-2 text-sm"
      />
    );
  }

  const display = value == null || value === ""
    ? <span className="text-muted-foreground italic text-xs">{placeholder ?? "—"}</span>
    : type === "date"
      ? new Date(String(value)).toLocaleDateString()
      : String(value);

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "w-full text-left px-2 py-1 rounded hover:bg-muted/60 transition-colors min-h-[28px] text-sm truncate",
        className,
      )}
    >
      {display}
    </button>
  );
}
