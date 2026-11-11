import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { COLOR_THEMES, FONTS } from "../config";
import { ColorInput, Group, Row, Segmented } from "./controls";
import { patch, type PanelProps } from "./types";

export function StylePanel({ config, update }: PanelProps) {
  const t = config.theme;
  const setTheme = (p: Partial<typeof t>) => update(patch("theme", p));

  return (
    <div className="space-y-5">
      <Group title="Colours">
        <div className="flex flex-wrap gap-1.5">
          {COLOR_THEMES.map((c) => {
            const on = t.primary === c.primary && t.secondary === c.secondary;
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => setTheme({ primary: c.primary, secondary: c.secondary })}
                className={cn(
                  "flex items-center gap-1.5 border px-2 py-1 text-xs",
                  on ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                )}
              >
                <span className="flex">
                  <span
                    className="h-3.5 w-3.5 rounded-full ring-2 ring-background"
                    style={{ background: c.primary }}
                  />
                  <span
                    className="-ml-1 h-3.5 w-3.5 rounded-full ring-2 ring-background"
                    style={{ background: c.secondary }}
                  />
                </span>
                {c.name}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <Row label="Main" htmlFor="c-primary">
            <ColorInput
              id="c-primary"
              value={t.primary}
              onChange={(v) => setTheme({ primary: v })}
            />
          </Row>
          <Row label="Second" htmlFor="c-secondary">
            <ColorInput
              id="c-secondary"
              value={t.secondary}
              onChange={(v) => setTheme({ secondary: v })}
            />
          </Row>
          <Row label="Text" htmlFor="c-text">
            <ColorInput id="c-text" value={t.text} onChange={(v) => setTheme({ text: v })} />
          </Row>
          <Row label="Page" htmlFor="c-bg">
            <ColorInput
              id="c-bg"
              value={t.background}
              onChange={(v) => setTheme({ background: v })}
            />
          </Row>
        </div>
      </Group>

      <Group title="Text">
        <Row label="Font" hint="All support Arabic">
          <Select value={t.font} onValueChange={(v) => setTheme({ font: v })}>
            <SelectTrigger className="h-8 w-48 rounded-none text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map((f) => (
                <SelectItem key={f.family} value={f.family} className="text-xs">
                  {f.family}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        <Row label="Text size" hint={`${Math.round(t.fontScale * 100)}%`}>
          <Slider
            value={[t.fontScale * 100]}
            min={85}
            max={115}
            step={5}
            onValueChange={([v]) => setTheme({ fontScale: v / 100 })}
            className="w-44"
            aria-label="Text size"
          />
        </Row>
        <Row label="Spacing">
          <Segmented
            label="Spacing"
            value={t.density}
            onChange={(v) => setTheme({ density: v })}
            options={[
              { value: "compact", label: "Compact" },
              { value: "normal", label: "Normal" },
              { value: "relaxed", label: "Relaxed" },
            ]}
          />
        </Row>
        <Row label="Labels" hint="Language of field labels and headings">
          <Segmented
            label="Label language"
            value={t.labels}
            onChange={(v) => setTheme({ labels: v })}
            options={[
              { value: "bilingual", label: "English + عربي" },
              { value: "english", label: "English" },
              { value: "arabic", label: "عربي" },
            ]}
          />
        </Row>
        <Row label="Arabic values too" hint="e.g. Ethiopia / إثيوبيا, where available">
          <Switch checked={t.arabicValues} onCheckedChange={(v) => setTheme({ arabicValues: v })} />
        </Row>
        <Row label="Hide empty fields" hint="Skip fields the candidate hasn't filled in">
          <Switch checked={t.hideEmpty} onCheckedChange={(v) => setTheme({ hideEmpty: v })} />
        </Row>
      </Group>

      <Group title="Shapes">
        <Row label="Section headings">
          <Segmented
            label="Heading style"
            value={t.headingStyle}
            onChange={(v) => setTheme({ headingStyle: v })}
            options={[
              { value: "bar", label: "Filled bar" },
              { value: "underline", label: "Underline" },
              { value: "accent", label: "Side accent" },
              { value: "plain", label: "Plain" },
            ]}
          />
        </Row>
        <Row label="Corners">
          <Segmented
            label="Corners"
            value={t.corners}
            onChange={(v) => setTheme({ corners: v })}
            options={[
              { value: "square", label: "Square" },
              { value: "rounded", label: "Rounded" },
            ]}
          />
        </Row>
        <Row label="Page border">
          <Segmented
            label="Page border"
            value={t.pageBorder}
            onChange={(v) => setTheme({ pageBorder: v })}
            options={[
              { value: "none", label: "None" },
              { value: "thin", label: "Thin" },
              { value: "thick", label: "Thick" },
            ]}
          />
        </Row>
      </Group>
    </div>
  );
}
