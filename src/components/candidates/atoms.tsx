import React, { useId, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { OPTION_COLORS } from "./types";

export function OptionPill({ label, className }: { label: string; className?: string }) {
  const color = OPTION_COLORS[label] ?? "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-semibold leading-none whitespace-nowrap", color, className)}>
      {label}
    </span>
  );
}

export function InlineDate({ value, onSave, display, showDays }: { value: string; onSave: (v: string | null) => void; display?: string; showDays?: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const fmt = (v: string) =>
    v ? new Date(v + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "";
  const days = showDays && value
    ? Math.floor((Date.now() - new Date(value + "T00:00:00").getTime()) / 86_400_000)
    : null;
  return (
    <>
      <button type="button" onClick={() => { setDraft(value); setOpen(true); }}
        className="text-left rounded-none px-1 -mx-1 py-0.5 hover:bg-muted/60 hover:ring-1 hover:ring-border min-w-[60px] block">
        {display ?? (value ? fmt(value) : <span className="text-muted-foreground">—</span>)}
        {days !== null && (
          <span className="block text-[11px] text-muted-foreground leading-none mt-0.5">
            ({days} day{days !== 1 ? "s" : ""})
          </span>
        )}
      </button>
      {open && (
        <Dialog open onOpenChange={(o) => { if (!o) setOpen(false); }}>
          <DialogContent className="max-w-xs rounded-none">
            <DialogHeader><DialogTitle>Set Date</DialogTitle></DialogHeader>
            <input autoFocus type="date" value={draft} onChange={(e) => setDraft(e.target.value)}
              className="w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            <DialogFooter>
              <Button variant="ghost" className="rounded-none" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="rounded-none" onClick={() => { onSave(draft || null); setOpen(false); }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export function InlineText({ value, onSave, suggestions }: { value: string; onSave: (v: string | null) => void; suggestions?: string[] }) {
  const listId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <button
        type="button"
        title={value || undefined}
        onClick={() => { setDraft(value); setEditing(true); }}
        className="text-left rounded-none px-1 -mx-1 py-0.5 hover:bg-muted/60 hover:ring-1 hover:ring-border min-w-[40px] line-clamp-2 break-words"
      >
        {value || <span className="text-muted-foreground">—</span>}
      </button>
    );
  }
  const commit = () => { setEditing(false); if (draft !== value) onSave(draft.trim() === "" ? null : draft); };
  const hasSugg = (suggestions?.length ?? 0) > 0;
  return (
    <>
      <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        list={hasSugg ? listId : undefined}
        className="rounded-none border border-primary bg-background px-1 py-0.5 text-[14px] text-foreground outline-none w-full max-w-full"
      />
      {hasSugg && <datalist id={listId}>{suggestions!.map((s) => <option key={s} value={s} />)}</datalist>}
    </>
  );
}

export function InlineSelect({ value, options, onSave }: { value: string; options: string[]; onSave: (v: string | null) => void }) {
  return (
    <Select value={value || "__clear__"} onValueChange={(v) => onSave(v === "__clear__" ? null : v)}>
      <SelectTrigger className="h-auto w-full max-w-full overflow-hidden gap-1 border-transparent bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:shrink-0 [&>span]:min-w-0 [&>span]:max-w-full">
        <SelectValue placeholder={<span className="text-muted-foreground text-[14px] px-1">—</span>} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__clear__" className="py-1 px-2 focus:bg-muted/50 text-muted-foreground">—</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="py-1 px-2 focus:bg-muted/50">
            <OptionPill label={o} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FilterSelect({
  value, onChange, options, placeholder, icon: Icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  icon?: React.ElementType;
}) {
  const isReset = value === "all" || !value;
  const hasColor = !isReset && !!OPTION_COLORS[value];
  return (
    <div className="flex items-center gap-0.5">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="border-0 bg-transparent shadow-none h-auto w-auto px-0 gap-1 text-[13px] font-bold text-foreground hover:opacity-70 transition-opacity [&>svg]:shrink-0">
          {Icon && <Icon className="h-3 w-3 shrink-0" />}
          {isReset ? (
            <span>{placeholder}</span>
          ) : hasColor ? (
            <span>{options.find((o) => o.value === value)?.label ?? value}</span>
          ) : (
            <SelectValue placeholder={placeholder} />
          )}
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => {
            const isAll = o.value === "all";
            const color = OPTION_COLORS[o.label] ?? OPTION_COLORS[o.value];
            return (
              <SelectItem key={o.value} value={o.value} className="py-1 px-2 focus:bg-muted/50">
                {isAll ? (
                  <span className="text-[13px] text-muted-foreground">{o.label}</span>
                ) : color ? (
                  <OptionPill label={o.label} />
                ) : (
                  <span className="text-[14px] text-foreground">{o.label}</span>
                )}
              </SelectItem>
            );
          })}
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

export function MultiFilterSelect({
  values, onChange, options, placeholder, icon: Icon,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  icon?: React.ElementType;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const isEmpty = values.length === 0;

  const toggle = (val: string) =>
    onChange(values.includes(val) ? values.filter((v) => v !== val) : [...values, val]);

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const triggerLabel = isEmpty
    ? placeholder
    : values.length === 1
      ? (options.find((o) => o.value === values[0])?.label ?? values[0])
      : `${placeholder} (${values.length})`;

  return (
    <div className="flex items-center gap-0.5">
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "group flex items-center gap-1 bg-transparent border-0 text-[13px] font-bold transition-opacity px-0",
              isEmpty ? "text-foreground hover:opacity-70" : "text-primary"
            )}
          >
            {Icon && <Icon className="h-3 w-3 shrink-0" />}
            {isEmpty ? (
              <span>{placeholder}</span>
            ) : (
              <>
                <span className="group-hover:hidden">{triggerLabel}</span>
                <span className="hidden group-hover:inline">{placeholder}</span>
              </>
            )}
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-1 rounded-none" align="start">
          <div className="px-1 pb-1">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full h-6 text-[12px] px-2 border border-border rounded-none bg-background outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-[220px] overflow-y-auto">
            {filtered.map((o) => {
              const checked = values.includes(o.value);
              const color = OPTION_COLORS[o.label] ?? OPTION_COLORS[o.value];
              return (
                <button
                  key={o.value}
                  type="button"
                  className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors", checked ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50")}
                  onClick={() => toggle(o.value)}
                >
                  <Checkbox checked={checked} className="h-3.5 w-3.5 pointer-events-none" />
                  {color ? (
                    <span className={cn("text-[13px] font-medium px-1.5 py-0.5", color)}>{o.label}</span>
                  ) : (
                    <span className="text-[13px] text-foreground">{o.label}</span>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-[12px] text-muted-foreground py-2">No results</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {!isEmpty && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="rounded-none p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Clear filter"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
