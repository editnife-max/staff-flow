import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PRESETS,
  SECOND_PLACEMENTS,
  STRUCTURES,
  type CustomCvConfig,
  type SecondPlacement,
} from "../config";
import { StructureWireframe } from "../wireframes";
import { Group, Row, Segmented } from "./controls";
import { patch, type PanelProps } from "./types";

/** Merges into the second-photo settings. */
const patchSecond =
  (p: Partial<CustomCvConfig["photo"]["second"]>) =>
  (c: CustomCvConfig): CustomCvConfig => ({
    ...c,
    photo: { ...c.photo, second: { ...c.photo.second, ...p } },
  });

/** Applies a preset's design but keeps this template's branding and contacts. */
function applyPreset(current: CustomCvConfig, presetConfig: CustomCvConfig): CustomCvConfig {
  return {
    ...presetConfig,
    header: {
      ...presetConfig.header,
      logoUrl: current.header.logoUrl,
      companyName: current.header.companyName,
      companyNameAr: current.header.companyNameAr,
      tagline: current.header.tagline,
    },
    contacts: current.contacts,
    footer: { ...presetConfig.footer, note: current.footer.note },
  };
}

export function LayoutPanel({ config, update }: PanelProps) {
  const structure = STRUCTURES.find((s) => s.id === config.structure)!;
  return (
    <div className="space-y-5">
      <Group
        title="Page structure"
        description="How the photo and sections are arranged on the page."
      >
        <div className="grid grid-cols-3 gap-2">
          {STRUCTURES.map((s) => {
            const on = s.id === config.structure;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => update((c) => ({ ...c, structure: s.id }))}
                aria-pressed={on}
                className={cn(
                  "flex flex-col items-center gap-1.5 border p-2 text-center transition-colors",
                  on ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                )}
              >
                <StructureWireframe
                  structure={s.id}
                  photoSide={config.photoSide}
                  color={on ? config.theme.primary : "#94a3b8"}
                  width={78}
                />
                <span
                  className={cn("text-xs font-medium", on ? "text-primary" : "text-foreground")}
                >
                  {s.name}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{structure.description}</p>
        <Row label="Photo side">
          <Segmented
            label="Photo side"
            value={config.photoSide}
            onChange={(v) => update((c) => ({ ...c, photoSide: v }))}
            options={[
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
            ]}
          />
        </Row>
        {(config.structure === "photo-column" || config.structure === "sidebar") && (
          <Row label={`${structure.sideLabel} width`}>
            <Segmented
              label="Column width"
              value={config.columnWidth}
              onChange={(v) => update((c) => ({ ...c, columnWidth: v }))}
              options={[
                { value: "narrow", label: "Narrow" },
                { value: "medium", label: "Medium" },
                { value: "wide", label: "Wide" },
              ]}
            />
          </Row>
        )}
      </Group>

      <Group title="Main photo">
        <Row label="Show main photo">
          <Switch
            checked={config.photo.show}
            onCheckedChange={(v) => update(patch("photo", { show: v }))}
          />
        </Row>
        {config.photo.show && (
          <>
            <Row label="Which photo">
              <Segmented
                label="Which photo"
                value={config.photo.source}
                onChange={(v) => update(patch("photo", { source: v }))}
                options={[
                  { value: "full", label: "Full size" },
                  { value: "head", label: "Passport size" },
                ]}
              />
            </Row>
            <Row label="Shape">
              <Segmented
                label="Photo shape"
                value={config.photo.shape}
                onChange={(v) => update(patch("photo", { shape: v }))}
                options={[
                  { value: "rect", label: "Square" },
                  { value: "rounded", label: "Rounded" },
                  { value: "circle", label: "Circle" },
                ]}
              />
            </Row>
            <Row label="Size">
              <Segmented
                label="Photo size"
                value={config.photo.size}
                onChange={(v) => update(patch("photo", { size: v }))}
                options={[
                  { value: "s", label: "Small" },
                  { value: "m", label: "Medium" },
                  { value: "l", label: "Large" },
                ]}
              />
            </Row>
            <Row label="Coloured frame">
              <Switch
                checked={config.photo.frame}
                onCheckedChange={(v) => update(patch("photo", { frame: v }))}
              />
            </Row>
            <Row
              label="Video buttons"
              hint="Play / Download under the photo when the candidate has a video"
            >
              <Switch
                checked={config.photo.videoButtons}
                onCheckedChange={(v) => update(patch("photo", { videoButtons: v }))}
              />
            </Row>
          </>
        )}
      </Group>

      <Group
        title="Second photo"
        description={`For CVs that show both photos: adds the ${
          config.photo.source === "full" ? "passport-size" : "full-size"
        } photo as well.`}
      >
        <Row label="Show second photo">
          <Switch
            checked={config.photo.second.show}
            onCheckedChange={(v) => update(patchSecond({ show: v }))}
          />
        </Row>
        {config.photo.second.show && (
          <>
            <Row label="Placement">
              <Select
                value={config.photo.second.placement}
                onValueChange={(v) => update(patchSecond({ placement: v as SecondPlacement }))}
              >
                <SelectTrigger className="h-8 w-52 rounded-none text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECOND_PLACEMENTS.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            {config.photo.second.placement === "name" && config.nameBlock.style === "none" && (
              <p className="text-[11px] text-amber-600">
                The candidate name band is hidden, so this photo won&apos;t show. Turn the name band
                on below.
              </p>
            )}
            {config.photo.second.placement === "column" && (
              <Row label="Size">
                <Segmented
                  label="Second photo size"
                  value={config.photo.second.size}
                  onChange={(v) => update(patchSecond({ size: v }))}
                  options={[
                    { value: "s", label: "Small" },
                    { value: "m", label: "Medium" },
                    { value: "l", label: "Large" },
                  ]}
                />
              </Row>
            )}
            <Row label="Shape">
              <Segmented
                label="Second photo shape"
                value={config.photo.second.shape}
                onChange={(v) => update(patchSecond({ shape: v }))}
                options={[
                  { value: "rect", label: "Square" },
                  { value: "rounded", label: "Rounded" },
                  { value: "circle", label: "Circle" },
                ]}
              />
            </Row>
          </>
        )}
      </Group>

      <Group
        title="Candidate name band"
        description="The candidate's name shown large under the header."
      >
        <Row label="Style">
          <Segmented
            label="Name band style"
            value={config.nameBlock.style}
            onChange={(v) => update(patch("nameBlock", { style: v }))}
            options={[
              { value: "band", label: "Coloured band" },
              { value: "plain", label: "Plain" },
              { value: "none", label: "Hide" },
            ]}
          />
        </Row>
        {config.nameBlock.style !== "none" && (
          <>
            <Row label="Show position applied for">
              <Switch
                checked={config.nameBlock.showPosition}
                onCheckedChange={(v) => update(patch("nameBlock", { showPosition: v }))}
              />
            </Row>
            <Row label="Show nationality">
              <Switch
                checked={config.nameBlock.showNationality}
                onCheckedChange={(v) => update(patch("nameBlock", { showNationality: v }))}
              />
            </Row>
          </>
        )}
      </Group>

      <Group title="Extra pages">
        <Row label="Attach passport page" hint="Adds the candidate's passport scan as page 2">
          <Switch
            checked={config.attachPassport}
            onCheckedChange={(v) => update((c) => ({ ...c, attachPassport: v }))}
          />
        </Row>
      </Group>

      <Group
        title="Start from a preset"
        description="Replaces the design. Your logo, company name and contacts are kept."
      >
        <div className="grid gap-2">
          {PRESETS.map((p) => (
            <AlertDialog key={p.id}>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-3 border border-border p-2.5 text-left hover:border-primary/40 hover:bg-muted/30"
                >
                  <Wand2 className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">{p.description}</span>
                  </span>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apply “{p.name}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The layout, sections, colours and footer style will be replaced. Your logo,
                    company name, tagline and contacts stay.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button onClick={() => update((c) => applyPreset(c, p.config()))}>
                      Apply preset
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ))}
        </div>
      </Group>
    </div>
  );
}
