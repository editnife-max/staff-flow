import { useState } from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  FIELDS,
  SECTIONS,
  STRUCTURES,
  type FieldToggle,
  type SectionConfig,
  type SectionId,
} from "../config";
import { Group, Row, Segmented, SortableList } from "./controls";
import type { PanelProps } from "./types";

export function SectionsPanel({ config, update }: PanelProps) {
  const [open, setOpen] = useState<SectionId | null>(null);
  const structure = STRUCTURES.find((s) => s.id === config.structure)!;
  const setSection = (id: SectionId, fn: (s: SectionConfig) => SectionConfig) =>
    update((c) => ({ ...c, sections: c.sections.map((s) => (s.id === id ? fn(s) : s)) }));

  const shown = config.sections.filter((s) => s.enabled).length;

  return (
    <div className="space-y-5">
      <Group
        title="Sections"
        description="Drag to reorder. Open a section to pick its column, style and fields."
        actions={<span className="text-xs text-muted-foreground">{shown} shown</span>}
      >
        <SortableList
          items={config.sections}
          getId={(s) => s.id}
          onReorder={(sections) => update((c) => ({ ...c, sections }))}
          className="divide-y divide-border border border-border"
          render={(sec) => {
            const def = SECTIONS[sec.id];
            const isOpen = open === sec.id;
            const visibleFields = sec.fields.filter((f) => f.enabled).length;
            return (
              <div className={cn(!sec.enabled && "opacity-60")}>
                <div className="flex items-center gap-2 py-2 pr-2">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : sec.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={isOpen}
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {sec.titleEn || def.en}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {sec.zone === "side" ? structure.sideLabel : structure.mainLabel} ·{" "}
                        {def.styles.find((x) => x.id === sec.style)?.label} · {visibleFields}/
                        {sec.fields.length} fields
                      </span>
                    </span>
                  </button>
                  <Switch
                    checked={sec.enabled}
                    onCheckedChange={(v) => setSection(sec.id, (s) => ({ ...s, enabled: v }))}
                    aria-label={`Show ${def.en}`}
                  />
                </div>
                {isOpen && (
                  <SectionDetails
                    sec={sec}
                    sideLabel={structure.sideLabel}
                    mainLabel={structure.mainLabel}
                    onChange={(fn) => setSection(sec.id, fn)}
                  />
                )}
              </div>
            );
          }}
        />
      </Group>
    </div>
  );
}

function SectionDetails({
  sec,
  sideLabel,
  mainLabel,
  onChange,
}: {
  sec: SectionConfig;
  sideLabel: string;
  mainLabel: string;
  onChange: (fn: (s: SectionConfig) => SectionConfig) => void;
}) {
  const def = SECTIONS[sec.id];
  const setField = (id: string, enabled: boolean) =>
    onChange((s) => ({ ...s, fields: s.fields.map((f) => (f.id === id ? { ...f, enabled } : f)) }));
  const allOn = sec.fields.every((f) => f.enabled);

  return (
    <div className="space-y-3 border-t border-border bg-muted/20 px-3 py-3">
      <Row label="Column">
        <Segmented
          label="Column"
          value={sec.zone}
          onChange={(v) => onChange((s) => ({ ...s, zone: v }))}
          options={[
            { value: "side", label: sideLabel },
            { value: "main", label: mainLabel },
          ]}
        />
      </Row>
      {def.styles.length > 1 && (
        <Row label="Style">
          <Select
            value={sec.style}
            onValueChange={(v) => onChange((s) => ({ ...s, style: v as SectionConfig["style"] }))}
          >
            <SelectTrigger className="h-8 w-48 rounded-none text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {def.styles.map((st) => (
                <SelectItem key={st.id} value={st.id} className="text-xs">
                  {st.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={sec.titleEn}
          maxLength={40}
          placeholder={def.en}
          onChange={(e) => onChange((s) => ({ ...s, titleEn: e.target.value }))}
          className="h-8 rounded-none text-xs"
          aria-label="Heading (English)"
        />
        <Input
          value={sec.titleAr}
          maxLength={40}
          dir="rtl"
          placeholder={def.ar}
          onChange={(e) => onChange((s) => ({ ...s, titleAr: e.target.value }))}
          className="h-8 rounded-none text-xs"
          aria-label="Heading (Arabic)"
        />
      </div>
      {sec.id !== "remarks" && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium">Fields (drag to reorder)</span>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() =>
                onChange((s) => ({
                  ...s,
                  fields: s.fields.map((f) => ({ ...f, enabled: !allOn })),
                }))
              }
            >
              {allOn ? "Hide all" : "Show all"}
            </button>
          </div>
          <SortableList<FieldToggle>
            items={sec.fields}
            getId={(f) => f.id}
            onReorder={(fields) => onChange((s) => ({ ...s, fields }))}
            className="divide-y divide-border border border-border bg-background"
            render={(f) => (
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 py-1.5 pr-2 text-xs",
                  !f.enabled && "text-muted-foreground",
                )}
              >
                <Checkbox
                  checked={f.enabled}
                  onCheckedChange={(v) => setField(f.id, v === true)}
                  className="h-3.5 w-3.5 rounded-none"
                />
                <span className="flex-1">{FIELDS[f.id]?.en ?? f.id}</span>
                <span dir="rtl" className="text-muted-foreground">
                  {FIELDS[f.id]?.ar}
                </span>
                {f.enabled ? (
                  <Eye className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
              </label>
            )}
          />
        </div>
      )}
    </div>
  );
}
