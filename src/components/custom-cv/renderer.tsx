// Draws a Custom CV template for one candidate on an exact A4 page.
// Inline styles only: the PDF export removes the app's stylesheets before rasterising.
// Every scrollable body area carries data-cv-zone so the editor can warn when content
// doesn't fit the page.
import React from "react";
import type { CvData, LevelStep } from "@/components/cv-layouts/cv-data";
import {
  Page,
  PAGE_H,
  PAGE_W,
  PhotoBox,
  Tick,
  VideoButtons,
} from "@/components/cv-layouts/primitives";
import {
  COLUMN_WIDTH_PX,
  FIELDS,
  HEADER_HEIGHT_PX,
  SECTIONS,
  onColor,
  tint,
  type Align,
  type ContactItem,
  type CustomCvConfig,
  type SectionConfig,
  type SlotPosition,
} from "./config";
import { ContactIcon } from "./icons";

export const ZONE_ATTR = "data-cv-zone";

const DENSITY = {
  compact: { row: 20, gap: 8, pad: 20 },
  normal: { row: 24, gap: 11, pad: 26 },
  relaxed: { row: 28, gap: 14, pad: 30 },
} as const;

const LEVEL_STEPS: LevelStep[] = ["POOR", "LITTLE", "FAIR", "FLUENT"];
const LEVEL_LABELS: Array<[string, string]> = [
  ["Poor", "ضعيف"],
  ["Little", "قليل"],
  ["Fair", "متوسط"],
  ["Fluent", "ممتاز"],
];

/** Font size that fits `text` on one line in `width` px, between `min` and `max`. */
function fitFont(text: string, width: number, max: number, min: number): number {
  const len = Math.max(1, text.trim().length);
  return Math.max(min, Math.min(max, width / (len * 0.6)));
}

function Ar({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span dir="rtl" style={{ unicodeBidi: "isolate", ...style }}>
      {children}
    </span>
  );
}

function CheckBox({ checked, color, size }: { checked: boolean; color: string; size: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flexShrink: 0,
        boxSizing: "border-box",
        borderRadius: 3,
        border: `1.5px solid ${checked ? color : "#9ca3af"}`,
        background: checked ? color : "#ffffff",
      }}
    >
      {checked && <Tick size={size * 0.62} color={onColor(color)} weight={2} />}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Context shared by all parts of the page
// ---------------------------------------------------------------------------

interface Ctx {
  d: CvData;
  c: CustomCvConfig;
  s: number;
  row: number;
  gap: number;
  radius: number;
  primary: string;
  secondary: string;
  ink: string;
  muted: string;
  line: string;
  labelBg: string;
}

/** Colours for content drawn on the coloured sidebar. */
interface Surface {
  dark: boolean;
  ink: string;
  muted: string;
  line: string;
  labelBg: string;
  accent: string;
}

function surfaceOf(ctx: Ctx, dark: boolean): Surface {
  if (!dark)
    return {
      dark,
      ink: ctx.ink,
      muted: ctx.muted,
      line: ctx.line,
      labelBg: ctx.labelBg,
      accent: ctx.primary,
    };
  const fg = onColor(ctx.primary);
  return {
    dark,
    ink: fg,
    muted: fg === "#ffffff" ? "rgba(255,255,255,0.72)" : "#374151",
    line: fg === "#ffffff" ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.2)",
    labelBg: "transparent",
    accent: ctx.secondary,
  };
}

// ---------------------------------------------------------------------------
// Labels and values
// ---------------------------------------------------------------------------

function LabelText({ en, ar, ctx }: { en: string; ar: string; ctx: Ctx }) {
  const mode = ctx.c.theme.labels;
  if (mode === "english") return <span>{en}</span>;
  if (mode === "arabic") return <Ar>{ar}</Ar>;
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
      <span>{en}</span>
      <Ar style={{ opacity: 0.85 }}>{ar}</Ar>
    </span>
  );
}

interface Row {
  id: string;
  en: string;
  ar: string;
  value: React.ReactNode;
  empty: boolean;
}

function rowsOf(sec: SectionConfig, ctx: Ctx): Row[] {
  return sec.fields.flatMap((f) => {
    const def = FIELDS[f.id];
    if (!f.enabled || !def) return [];
    const v = def.value(ctx.d).trim();
    const ar = ctx.c.theme.arabicValues ? (def.valueAr?.(ctx.d) ?? "").trim() : "";
    if (ctx.c.theme.hideEmpty && !v) return [];
    const value =
      ar && v ? (
        <>
          {v} / <Ar>{ar}</Ar>
        </>
      ) : (
        v || "—"
      );
    return [{ id: f.id, en: def.en, ar: def.ar, value, empty: !v }];
  });
}

// ---------------------------------------------------------------------------
// Section heading
// ---------------------------------------------------------------------------

function Heading({ sec, ctx, sf }: { sec: SectionConfig; ctx: Ctx; sf: Surface }) {
  const def = SECTIONS[sec.id];
  const en = sec.titleEn || def.en;
  const ar = sec.titleAr || def.ar;
  const mode = ctx.c.theme.labels;
  const fontSize = 12 * ctx.s;
  const text =
    mode === "english" ? (
      <span>{en.toUpperCase()}</span>
    ) : mode === "arabic" ? (
      <Ar>{ar}</Ar>
    ) : (
      <>
        <span>{en.toUpperCase()}</span>
        <Ar style={{ fontSize: fontSize * 1.05 }}>{ar}</Ar>
      </>
    );
  const base: React.CSSProperties = {
    display: "flex",
    justifyContent: mode === "arabic" ? "flex-end" : "space-between",
    alignItems: "center",
    gap: 10,
    fontSize,
    fontWeight: 800,
    letterSpacing: 0.6,
    flexShrink: 0,
  };
  switch (ctx.c.theme.headingStyle) {
    case "bar": {
      const bg = sf.dark ? ctx.secondary : ctx.primary;
      return (
        <div
          style={{
            ...base,
            background: bg,
            color: onColor(bg),
            height: Math.round(ctx.row * 1.05),
            padding: "0 10px",
            borderRadius: ctx.radius ? `${ctx.radius}px ${ctx.radius}px 0 0` : 0,
          }}
        >
          {text}
        </div>
      );
    }
    case "underline":
      return (
        <div
          style={{
            ...base,
            color: sf.dark ? ctx.secondary : ctx.primary,
            borderBottom: `2px solid ${sf.dark ? sf.line : ctx.secondary}`,
            paddingBottom: 3,
          }}
        >
          {text}
        </div>
      );
    case "accent":
      return (
        <div
          style={{
            ...base,
            color: sf.dark ? sf.ink : ctx.primary,
            borderLeft: `4px solid ${ctx.secondary}`,
            paddingLeft: 8,
            background: sf.dark ? "transparent" : tint(ctx.primary, 0.93),
            height: Math.round(ctx.row * 1.05),
            paddingRight: 8,
          }}
        >
          {text}
        </div>
      );
    default:
      return <div style={{ ...base, color: sf.dark ? ctx.secondary : ctx.primary }}>{text}</div>;
  }
}

// ---------------------------------------------------------------------------
// Section bodies
// ---------------------------------------------------------------------------

function TableRows({
  rows,
  ctx,
  sf,
  width,
}: {
  rows: Row[];
  ctx: Ctx;
  sf: Surface;
  width: number;
}) {
  const mode = ctx.c.theme.labels;
  // In narrow columns a third (Arabic) column gets cramped: stack both labels instead.
  const stacked = mode === "bilingual" && width < 360;
  const cols =
    mode === "bilingual" && !stacked
      ? "minmax(0,1.05fr) minmax(0,1.5fr) minmax(0,0.95fr)"
      : "minmax(0,0.9fr) minmax(0,1.3fr)";
  return (
    <div
      style={{
        border: `1px solid ${sf.line}`,
        borderTop: ctx.c.theme.headingStyle === "bar" ? "none" : `1px solid ${sf.line}`,
      }}
    >
      {rows.map((r, i) => (
        <div
          key={r.id}
          style={{
            display: "grid",
            gridTemplateColumns: cols,
            minHeight: ctx.row,
            borderTop: i ? `1px solid ${sf.line}` : undefined,
          }}
        >
          <div
            style={{
              background: sf.labelBg,
              display: "flex",
              flexDirection: stacked ? "column" : "row",
              // Stacked: column, centred vertically. Otherwise: row, left-aligned.
              alignItems: stacked ? "flex-start" : "center",
              justifyContent: stacked ? "center" : "flex-start",
              padding: stacked ? "2px 7px" : "0 7px",
              fontSize: 10.5 * ctx.s,
              fontWeight: 700,
              lineHeight: 1.2,
              color: sf.dark ? sf.muted : ctx.primary,
              borderRight: `1px solid ${sf.line}`,
            }}
          >
            {mode === "arabic" ? <Ar>{r.ar}</Ar> : r.en}
            {stacked && (
              <Ar style={{ fontSize: 10 * ctx.s, fontWeight: 600, opacity: 0.85 }}>{r.ar}</Ar>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "0 8px",
              fontSize: 12 * ctx.s,
              fontWeight: 700,
              color: sf.ink,
              overflow: "hidden",
            }}
          >
            {r.value}
          </div>
          {mode === "bilingual" && !stacked && (
            <div
              style={{
                background: sf.labelBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                padding: "0 7px",
                borderLeft: `1px solid ${sf.line}`,
                color: sf.dark ? sf.muted : ctx.primary,
              }}
            >
              <Ar style={{ fontSize: 11 * ctx.s, fontWeight: 600 }}>{r.ar}</Ar>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function GridRows({ rows, ctx, sf, width }: { rows: Row[]; ctx: Ctx; sf: Surface; width: number }) {
  const cols = width >= 320 ? 2 : 1;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
        columnGap: 14,
        rowGap: Math.round(ctx.gap * 0.6),
        paddingTop: 6,
      }}
    >
      {rows.map((r) => (
        <div key={r.id} style={{ minWidth: 0 }}>
          <div
            style={{ fontSize: 9.5 * ctx.s, fontWeight: 700, color: sf.muted, letterSpacing: 0.4 }}
          >
            <LabelText en={r.en.toUpperCase()} ar={r.ar} ctx={ctx} />
          </div>
          <div style={{ fontSize: 12.5 * ctx.s, fontWeight: 700, color: sf.ink, lineHeight: 1.35 }}>
            {r.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListRows({ rows, ctx, sf }: { rows: Row[]; ctx: Ctx; sf: Surface }) {
  return (
    <div style={{ paddingTop: 4 }}>
      {rows.map((r) => (
        <div
          key={r.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 10,
            minHeight: ctx.row - 2,
            borderBottom: `1px dashed ${sf.line}`,
            padding: "3px 0",
          }}
        >
          <span style={{ fontSize: 10.5 * ctx.s, fontWeight: 600, color: sf.muted, flexShrink: 0 }}>
            <LabelText en={r.en} ar={r.ar} ctx={ctx} />
          </span>
          <span
            style={{
              fontSize: 12 * ctx.s,
              fontWeight: 700,
              color: sf.ink,
              textAlign: "right",
              minWidth: 0,
            }}
          >
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function stepOf(d: CvData, id: string): number {
  const step = id === "english" ? d.englishStep : id === "arabic" ? d.arabicStep : null;
  return step ? LEVEL_STEPS.indexOf(step) : -1;
}

function Languages({
  sec,
  ctx,
  sf,
  width,
}: {
  sec: SectionConfig;
  ctx: Ctx;
  sf: Surface;
  width: number;
}) {
  const langs = sec.fields.filter((f) => f.enabled && FIELDS[f.id]);
  if (sec.style === "ticks") {
    const cols = "minmax(0,1.4fr) repeat(4, minmax(0,1fr))";
    const levelHead = (i: number) =>
      ctx.c.theme.labels === "arabic" ? <Ar>{LEVEL_LABELS[i][1]}</Ar> : LEVEL_LABELS[i][0];
    return (
      <div
        style={{
          border: `1px solid ${sf.line}`,
          borderTop: ctx.c.theme.headingStyle === "bar" ? "none" : `1px solid ${sf.line}`,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: cols,
            height: ctx.row - 2,
            background: sf.labelBg,
            fontSize: 9.5 * ctx.s,
            fontWeight: 700,
            color: sf.dark ? sf.muted : ctx.primary,
          }}
        >
          <div />
          {LEVEL_LABELS.map((_, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {levelHead(i)}
            </div>
          ))}
        </div>
        {langs.map((f) => {
          const idx = stepOf(ctx.d, f.id);
          return (
            <div
              key={f.id}
              style={{
                display: "grid",
                gridTemplateColumns: cols,
                // Grows when a bilingual label wraps in a narrow column.
                minHeight: ctx.row,
                borderTop: `1px solid ${sf.line}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "2px 7px",
                  fontSize: 11 * ctx.s,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  color: sf.ink,
                }}
              >
                <LabelText en={FIELDS[f.id].en} ar={FIELDS[f.id].ar} ctx={ctx} />
              </div>
              {LEVEL_STEPS.map((_, i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <CheckBox
                    checked={idx === i}
                    color={sf.dark ? ctx.secondary : ctx.primary}
                    size={12 * ctx.s}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }
  if (sec.style === "bars") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 6 }}>
        {langs.map((f) => {
          const idx = stepOf(ctx.d, f.id);
          return (
            <div key={f.id}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11 * ctx.s,
                  fontWeight: 700,
                  color: sf.ink,
                  marginBottom: 3,
                }}
              >
                <LabelText en={FIELDS[f.id].en} ar={FIELDS[f.id].ar} ctx={ctx} />
                <span style={{ color: sf.muted }}>{FIELDS[f.id].value(ctx.d) || "—"}</span>
              </div>
              <div style={{ display: "flex", gap: 3 }}>
                {LEVEL_STEPS.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      background:
                        i <= idx
                          ? ctx.secondary
                          : sf.dark
                            ? "rgba(255,255,255,0.22)"
                            : tint(ctx.primary, 0.85),
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  const rows = rowsOf(sec, ctx);
  return sec.style === "table" ? (
    <TableRows rows={rows} ctx={ctx} sf={sf} width={width} />
  ) : (
    <ListRows rows={rows} ctx={ctx} sf={sf} />
  );
}

function Experience({ sec, ctx, sf }: { sec: SectionConfig; ctx: Ctx; sf: Surface }) {
  const rows = rowsOf(sec, ctx);
  if (sec.style !== "table") return <ListRows rows={rows} ctx={ctx} sf={sf} />;
  const cols = `repeat(${Math.max(1, rows.length)}, minmax(0,1fr))`;
  return (
    <div
      style={{
        border: `1px solid ${sf.line}`,
        borderTop: ctx.c.theme.headingStyle === "bar" ? "none" : `1px solid ${sf.line}`,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          height: ctx.row - 2,
          background: sf.labelBg,
          fontSize: 10 * ctx.s,
          fontWeight: 700,
          color: sf.dark ? sf.muted : ctx.primary,
        }}
      >
        {rows.map((r, i) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderLeft: i ? `1px solid ${sf.line}` : undefined,
            }}
          >
            <LabelText en={r.en} ar={r.ar} ctx={ctx} />
          </div>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          height: ctx.row,
          borderTop: `1px solid ${sf.line}`,
          fontSize: 12 * ctx.s,
          fontWeight: 700,
          color: sf.ink,
        }}
      >
        {rows.map((r, i) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderLeft: i ? `1px solid ${sf.line}` : undefined,
            }}
          >
            {r.value}
          </div>
        ))}
      </div>
    </div>
  );
}

function Skills({
  sec,
  ctx,
  sf,
  width,
}: {
  sec: SectionConfig;
  ctx: Ctx;
  sf: Surface;
  width: number;
}) {
  const skills = sec.fields
    .filter((f) => f.enabled && FIELDS[f.id])
    .map((f) => ({ id: f.id, def: FIELDS[f.id], has: FIELDS[f.id].value(ctx.d) !== "" }));
  const mode = ctx.c.theme.labels;
  const color = sf.dark ? ctx.secondary : ctx.primary;
  if (sec.style === "chips") {
    const mine = skills.filter((x) => x.has);
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 6 }}>
        {mine.length === 0 && <span style={{ fontSize: 11 * ctx.s, color: sf.muted }}>—</span>}
        {mine.map((x) => (
          <span
            key={x.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 9px",
              borderRadius: 999,
              background: sf.dark ? "rgba(255,255,255,0.14)" : tint(color, 0.88),
              color: sf.dark ? sf.ink : color,
              fontSize: 11 * ctx.s,
              fontWeight: 700,
            }}
          >
            <Tick size={9 * ctx.s} color={sf.dark ? sf.ink : color} weight={2} />
            {mode === "arabic" ? <Ar>{x.def.ar}</Ar> : x.def.en}
            {mode === "bilingual" && <Ar style={{ fontWeight: 600, opacity: 0.75 }}>{x.def.ar}</Ar>}
          </span>
        ))}
      </div>
    );
  }
  const cols = width >= 560 ? 3 : width >= 320 ? 2 : 1;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
        columnGap: 10,
        paddingTop: 4,
      }}
    >
      {skills.map((x) => (
        <div
          key={x.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            height: ctx.row - 2,
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          <CheckBox checked={x.has} color={color} size={13 * ctx.s} />
          {mode !== "arabic" && (
            <span style={{ fontSize: 11 * ctx.s, fontWeight: 700, color: sf.ink }}>{x.def.en}</span>
          )}
          {mode !== "english" && (
            <Ar
              style={{
                fontSize: 10.5 * ctx.s,
                color: sf.muted,
                marginLeft: mode === "bilingual" ? "auto" : 0,
              }}
            >
              {x.def.ar}
            </Ar>
          )}
        </div>
      ))}
    </div>
  );
}

function SectionView({
  sec,
  ctx,
  sf,
  width,
}: {
  sec: SectionConfig;
  ctx: Ctx;
  sf: Surface;
  width: number;
}) {
  let body: React.ReactNode;
  if (sec.id === "languages") body = <Languages sec={sec} ctx={ctx} sf={sf} width={width} />;
  else if (sec.id === "experience") body = <Experience sec={sec} ctx={ctx} sf={sf} />;
  else if (sec.id === "skills") body = <Skills sec={sec} ctx={ctx} sf={sf} width={width} />;
  else if (sec.id === "remarks") {
    const text = ctx.d.remark.trim();
    if (!text && ctx.c.theme.hideEmpty) return null;
    body = (
      <div
        style={{
          border: `1px solid ${sf.line}`,
          borderTop: ctx.c.theme.headingStyle === "bar" ? "none" : `1px solid ${sf.line}`,
          padding: "6px 9px",
          minHeight: 34 * ctx.s,
          maxHeight: 96 * ctx.s,
          overflow: "hidden",
          fontSize: 11.5 * ctx.s,
          lineHeight: 1.45,
          color: sf.ink,
        }}
      >
        {text || "—"}
      </div>
    );
  } else {
    const rows = rowsOf(sec, ctx);
    if (rows.length === 0) return null;
    body =
      sec.style === "grid" ? (
        <GridRows rows={rows} ctx={ctx} sf={sf} width={width} />
      ) : sec.style === "list" ? (
        <ListRows rows={rows} ctx={ctx} sf={sf} />
      ) : (
        <TableRows rows={rows} ctx={ctx} sf={sf} width={width} />
      );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <Heading sec={sec} ctx={ctx} sf={sf} />
      {body}
    </div>
  );
}

function Zone({
  secs,
  ctx,
  sf,
  width,
  style,
}: {
  secs: SectionConfig[];
  ctx: Ctx;
  sf: Surface;
  width: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      {...{ [ZONE_ATTR]: "" }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: ctx.gap,
        minHeight: 0,
        overflow: "hidden",
        ...style,
      }}
    >
      {secs.map((sec) => (
        <SectionView key={sec.id} sec={sec} ctx={ctx} sf={sf} width={width} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Photo
// ---------------------------------------------------------------------------

// The second photo is the other one: passport-size when the main photo is full-size.
const SECOND_W = { s: 74, m: 92, l: 112 } as const;

function secondSrc(ctx: Ctx): string | null {
  const { photo: head, fullPhoto: full } = ctx.d.photos;
  return ctx.c.photo.source === "head" ? (full ?? head) : (head ?? full);
}

function secondSize(ctx: Ctx, width?: number): { w: number; h: number } {
  const s = ctx.c.photo.second;
  const w = width ?? SECOND_W[s.size];
  return { w, h: s.shape === "circle" ? w : Math.round(w * 1.28) };
}

/** True when the second photo is shown at this placement. */
function secondAt(ctx: Ctx, placement: CustomCvConfig["photo"]["second"]["placement"]): boolean {
  return ctx.c.photo.second.show && ctx.c.photo.second.placement === placement;
}

function SecondPhoto({ ctx, dark, width }: { ctx: Ctx; dark: boolean; width?: number }) {
  const s = ctx.c.photo.second;
  const { w, h } = secondSize(ctx, width);
  return (
    <PhotoBox
      src={secondSrc(ctx)}
      fit="cover"
      position="center top"
      placeholder={
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 700,
            color: dark ? "rgba(255,255,255,0.7)" : "#9ca3af",
          }}
        >
          Photo
        </div>
      }
      style={{
        width: w,
        height: h,
        flexShrink: 0,
        borderRadius: s.shape === "circle" ? "50%" : s.shape === "rounded" ? 8 : 0,
        border: `2px solid ${dark ? "#ffffff" : ctx.secondary}`,
        backgroundColor: dark ? tint(ctx.primary, 0.15) : tint(ctx.primary, 0.94),
        overflow: "hidden",
      }}
    />
  );
}

/**
 * The photo area: the main photo and/or the second photo (when it's placed "with the
 * main photo"). Stacked in a column, or side by side in a row.
 */
function PhotoArea({
  ctx,
  width,
  height,
  dark,
  direction,
}: {
  ctx: Ctx;
  /** Width of the main photo. */
  width: number;
  /** Total height available (column) or main photo height (row). */
  height: number;
  dark: boolean;
  direction: "column" | "row";
}) {
  const main = ctx.c.photo.show;
  const second = secondAt(ctx, "column");
  if (!main && !second) return null;
  const sec = secondSize(ctx);
  if (direction === "row") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: ctx.c.photoSide === "right" ? "row-reverse" : "row",
          alignItems: "flex-start",
          gap: 8,
          flexShrink: 0,
        }}
      >
        {main && <Photo ctx={ctx} width={width} height={height} dark={dark} />}
        {second && <SecondPhoto ctx={ctx} dark={dark} />}
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
        width,
      }}
    >
      {second && (
        <SecondPhoto ctx={ctx} dark={dark} width={main ? undefined : Math.min(width, 150)} />
      )}
      {main && (
        <Photo ctx={ctx} width={width} height={height - (second ? sec.h + 8 : 0)} dark={dark} />
      )}
    </div>
  );
}

/** Width a row-direction PhotoArea takes. */
function photoAreaWidth(ctx: Ctx, mainW: number): number {
  const main = ctx.c.photo.show ? mainW : 0;
  const second = secondAt(ctx, "column") ? secondSize(ctx).w : 0;
  return main + second + (main && second ? 8 : 0);
}

function Photo({
  ctx,
  width,
  height,
  dark,
}: {
  ctx: Ctx;
  width: number;
  height: number;
  dark: boolean;
}) {
  const { photo } = ctx.c;
  const src =
    photo.source === "head"
      ? (ctx.d.photos.photo ?? ctx.d.photos.fullPhoto)
      : (ctx.d.photos.fullPhoto ?? ctx.d.photos.photo);
  const video = photo.videoButtons ? ctx.d.video : null;
  const boxH = Math.max(80, height - (video ? 44 : 0));
  const circle = photo.shape === "circle";
  const size = circle ? Math.min(width, boxH) : 0;
  return (
    <div
      style={{
        width,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
      }}
    >
      <PhotoBox
        src={src}
        fit={circle ? "cover" : "contain"}
        position={circle ? "center top" : "center"}
        placeholder={
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: dark ? "rgba(255,255,255,0.7)" : "#9ca3af",
            }}
          >
            Photo
          </div>
        }
        style={{
          width: circle ? size : width,
          height: circle ? size : boxH,
          borderRadius: circle ? "50%" : photo.shape === "rounded" ? 10 : 0,
          border: photo.frame
            ? `3px solid ${dark ? "#ffffff" : ctx.secondary}`
            : `1px solid ${dark ? "rgba(255,255,255,0.3)" : ctx.line}`,
          backgroundColor: dark ? tint(ctx.primary, 0.15) : tint(ctx.primary, 0.94),
          overflow: "hidden",
        }}
      />
      {video && (
        <VideoButtons
          play={video.play}
          download={video.download}
          color={dark ? ctx.secondary : ctx.primary}
          height={36}
          style={{ width }}
        />
      )}
    </div>
  );
}

const PHOTO_HEIGHT = { s: 240, m: 300, l: 360 } as const;
const SINGLE_PHOTO_WIDTH = { s: 150, m: 180, l: 210 } as const;

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

const LOGO_H = { s: 42, m: 60, l: 78 } as const;
const NAME_SIZE = { s: 16, m: 21, l: 26, xl: 32 } as const;

function ContactLine({
  item,
  ctx,
  color,
  iconColor,
  fontSize,
}: {
  item: ContactItem;
  ctx: Ctx;
  color: string;
  iconColor: string;
  fontSize: number;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize,
        fontWeight: 600,
        color,
        whiteSpace: "nowrap",
      }}
    >
      <ContactIcon kind={item.kind} size={Math.round(fontSize * 1.15)} color={iconColor} />
      {item.label && <span style={{ fontWeight: 700 }}>{item.label}:</span>}
      <span>{item.value}</span>
    </span>
  );
}

function Header({ ctx, width, logoSrc }: { ctx: Ctx; width: number; logoSrc: string | null }) {
  const h = ctx.c.header;
  const H = HEADER_HEIGHT_PX[h.height];
  const band = h.style === "band";
  const bg = band ? ctx.primary : "transparent";
  const fg = band ? onColor(ctx.primary) : ctx.primary;
  const accent = band
    ? onColor(ctx.primary) === "#ffffff"
      ? tint(ctx.secondary, 0.25)
      : ctx.secondary
    : ctx.secondary;
  const padX = h.style === "plain" ? 0 : 16;
  const innerW = width - padX * 2;
  const logoH = Math.min(LOGO_H[h.logoSize], H - 16);
  const logoW = Math.round(logoH * 2.4);
  const logoUrl = logoSrc ?? h.logoUrl;
  // The second photo can sit in a header corner, filling the header's height.
  const photoH = H - 14;
  const photoW = ctx.c.photo.second.shape === "circle" ? photoH : Math.round(photoH / 1.28);

  const slots: Align[] = ["left", "center", "right"];
  const at = (pos: SlotPosition, slot: Align) => pos === slot;
  const contacts = ctx.c.contacts.filter((x) => x.placement.startsWith("header-"));
  const info = slots.map((slot) => ({
    slot,
    logo: !!logoUrl && at(h.logoPosition, slot),
    photo:
      (slot === "left" && secondAt(ctx, "header-left")) ||
      (slot === "right" && secondAt(ctx, "header-right")),
    company: !!h.companyName.trim() && at(h.companyPosition, slot),
    title: !!(h.titleEn.trim() || h.titleAr.trim()) && at(h.titlePosition, slot),
    contacts: contacts.filter((x) => x.placement === `header-${slot}`),
  }));
  const hasText = (i: (typeof info)[number]) => i.company || i.title;
  const used = (i: (typeof info)[number]) =>
    i.logo || i.photo || hasText(i) || i.contacts.length > 0;
  /** Width of the logo and/or photo in a slot. */
  const mediaW = (i: (typeof info)[number]) =>
    (i.logo ? logoW : 0) + (i.photo ? photoW : 0) + (i.logo && i.photo ? 10 : 0);
  // Width a slot needs. The company name is flexible (it takes whatever is left);
  // a title or contact list only needs room for its own text.
  const titleW = Math.min(
    230,
    Math.max(110, Math.max(h.titleEn.length * 7.2, h.titleAr.length * 8) * ctx.s),
  );
  const fixedNeed = (i: (typeof info)[number]) => {
    if (!used(i)) return 0;
    const text = i.company ? 230 : i.title ? titleW : i.contacts.length ? 190 : 0;
    return mediaW(i) + text + (mediaW(i) && (hasText(i) || i.contacts.length) ? 12 : 0);
  };

  // Slot widths. The slot holding the company name grows to fill the header, so the
  // name prints as large as possible; a used centre keeps equal sides so it stays centred.
  const [L, C, R] = info;
  const GAP = 14;
  let widths: [number, number, number];
  if (used(C)) {
    let side = Math.max(fixedNeed(L), fixedNeed(R));
    // Company on a side: give the sides more and keep the centre to its own needs.
    if (L.company || R.company) side = Math.max(side, (innerW - fixedNeed(C) - GAP * 2) / 2);
    side = Math.min(side, Math.max(0, (innerW - 160 - GAP * 2) / 2));
    widths = [side, innerW - side * 2 - (side ? GAP * 2 : 0), side];
  } else if (used(L) && used(R)) {
    if (L.company && !R.company) widths = [innerW - fixedNeed(R) - GAP, 0, fixedNeed(R)];
    else if (R.company && !L.company) widths = [fixedNeed(L), 0, innerW - fixedNeed(L) - GAP];
    else if (hasText(L) && !hasText(R)) widths = [innerW - fixedNeed(R) - GAP, 0, fixedNeed(R)];
    else if (hasText(R) && !hasText(L)) widths = [fixedNeed(L), 0, innerW - fixedNeed(L) - GAP];
    else widths = [(innerW - GAP) / 2, 0, (innerW - GAP) / 2];
  } else widths = [used(L) ? innerW : 0, 0, used(R) ? innerW : 0];

  const block = (i: (typeof info)[number], w: number) => {
    if (!used(i) || w <= 0) return null;
    const isCenter = i.slot === "center";
    const align = i.slot === "left" ? "flex-start" : i.slot === "right" ? "flex-end" : "center";
    const textAlign = i.slot as React.CSSProperties["textAlign"];
    const media = mediaW(i);
    const textW = Math.max(80, w - (!isCenter && media && hasText(i) ? media + 12 : 0));
    const companySize =
      h.companySize === "auto"
        ? fitFont(h.companyName, textW, Math.min(34, H * 0.36), 13) * Math.min(1, ctx.s)
        : NAME_SIZE[h.companySize] * ctx.s;
    const texts = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: align,
          gap: 2,
          minWidth: 0,
          maxWidth: textW,
          textAlign,
        }}
      >
        {i.company && (
          <>
            <div
              style={{
                fontSize: companySize,
                fontWeight: 800,
                lineHeight: 1.12,
                color: fg,
                overflow: "hidden",
                maxHeight: companySize * 2.3,
                wordBreak: "break-word",
              }}
            >
              {h.companyName}
            </div>
            {h.companyNameAr && (
              <Ar
                style={{ fontSize: companySize * 0.62, fontWeight: 700, color: fg, opacity: 0.9 }}
              >
                {h.companyNameAr}
              </Ar>
            )}
            {h.tagline && (
              <div
                style={{ fontSize: 10 * ctx.s, fontWeight: 600, color: accent, letterSpacing: 1 }}
              >
                {h.tagline}
              </div>
            )}
          </>
        )}
        {i.title && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: align,
              marginTop: i.company ? 3 : 0,
            }}
          >
            {h.titleEn && (
              <span
                style={{
                  fontSize: (i.company ? 11.5 : 17) * ctx.s,
                  fontWeight: 800,
                  letterSpacing: i.company ? 2 : 1.2,
                  color: i.company ? accent : fg,
                  lineHeight: 1.2,
                }}
              >
                {h.titleEn.toUpperCase()}
              </span>
            )}
            {h.titleAr && (
              <Ar
                style={{
                  fontSize: (i.company ? 12 : 15) * ctx.s,
                  fontWeight: 700,
                  color: i.company ? accent : fg,
                }}
              >
                {h.titleAr}
              </Ar>
            )}
          </div>
        )}
        {i.contacts.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: align,
              gap: 2,
              marginTop: hasText(i) ? 4 : 0,
            }}
          >
            {i.contacts.map((x) => (
              <ContactLine
                key={x.id}
                item={x}
                ctx={ctx}
                color={fg}
                iconColor={accent}
                fontSize={10 * ctx.s}
              />
            ))}
          </div>
        )}
      </div>
    );
    const logo = i.logo ? (
      <PhotoBox
        src={logoUrl}
        fit="contain"
        position={`${i.slot === "right" ? "right" : i.slot === "left" ? "left" : "center"} center`}
        style={{ width: logoW, height: logoH, flexShrink: 0 }}
      />
    ) : null;
    // The corner photo sits at the outer edge, then the logo, then the text.
    const photo = i.photo ? <SecondPhoto ctx={ctx} dark={band} width={photoW} /> : null;
    const hasTexts = hasText(i) || i.contacts.length > 0;
    return (
      <div
        style={{
          width: w,
          flexShrink: 0,
          display: "flex",
          flexDirection: isCenter ? "column" : i.slot === "right" ? "row-reverse" : "row",
          alignItems: "center",
          justifyContent: align,
          gap: isCenter ? 4 : 10,
          minWidth: 0,
        }}
      >
        {photo}
        {logo}
        {hasTexts && texts}
      </div>
    );
  };

  return (
    <div
      style={{
        height: H,
        flexShrink: 0,
        background: bg,
        border: h.style === "outline" ? `2px solid ${ctx.primary}` : undefined,
        borderBottom:
          h.style === "plain"
            ? `3px solid ${ctx.primary}`
            : h.style === "outline"
              ? `2px solid ${ctx.primary}`
              : undefined,
        borderRadius: h.style === "plain" ? 0 : ctx.radius,
        padding: `0 ${padX}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {block(L, widths[0]) ?? <div />}
      {block(C, widths[1])}
      {block(R, widths[2]) ?? <div />}
      {h.style === "plain" && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -6,
            height: 1,
            background: ctx.secondary,
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Name block and footer
// ---------------------------------------------------------------------------

function NameBlock({ ctx }: { ctx: Ctx }) {
  const n = ctx.c.nameBlock;
  if (n.style === "none") return null;
  const d = ctx.d;
  const sub = [n.showPosition ? d.occupationEn : "", n.showNationality ? d.nationalityEn : ""]
    .filter(Boolean)
    .join("  ·  ");
  const subAr = [n.showPosition ? d.occupationAr : "", n.showNationality ? d.nationalityAr : ""]
    .filter(Boolean)
    .join("  ·  ");
  // The second photo can sit at the start of the name band.
  const photo = secondAt(ctx, "name");
  if (n.style === "band") {
    const bg = ctx.c.header.style === "band" ? ctx.secondary : ctx.primary;
    const fg = onColor(bg);
    return (
      <div
        style={{
          flexShrink: 0,
          background: bg,
          color: fg,
          borderRadius: ctx.radius,
          padding: photo ? "6px 14px 6px 6px" : "8px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        {photo && <SecondPhoto ctx={ctx} dark={onColor(bg) === "#ffffff"} width={56} />}
        <span
          style={{
            fontSize: fitFont(d.fullName, photo ? 370 : 430, 21 * ctx.s, 14),
            fontWeight: 800,
            whiteSpace: "nowrap",
            overflow: "hidden",
            flex: 1,
            minWidth: 0,
          }}
        >
          {d.fullName}
        </span>
        {(sub || subAr) && (
          <span
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              fontSize: 11.5 * ctx.s,
              fontWeight: 700,
              lineHeight: 1.3,
              flexShrink: 0,
            }}
          >
            {sub && <span>{sub}</span>}
            {subAr && ctx.c.theme.labels !== "english" && <Ar>{subAr}</Ar>}
          </span>
        )}
      </div>
    );
  }
  return (
    <div
      style={{
        flexShrink: 0,
        borderBottom: `2px solid ${tint(ctx.primary, 0.75)}`,
        paddingBottom: 6,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      {photo && <SecondPhoto ctx={ctx} dark={false} width={58} />}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: fitFont(d.fullName, photo ? 450 : 520, 26 * ctx.s, 16),
            fontWeight: 800,
            color: ctx.primary,
            lineHeight: 1.15,
          }}
        >
          {d.fullName}
        </div>
        {(sub || subAr) && (
          <div
            style={{
              display: "flex",
              gap: 12,
              fontSize: 12.5 * ctx.s,
              fontWeight: 700,
              color: ctx.muted,
              marginTop: 2,
            }}
          >
            {sub && <span>{sub}</span>}
            {subAr && ctx.c.theme.labels !== "english" && <Ar>{subAr}</Ar>}
          </div>
        )}
      </div>
    </div>
  );
}

function Footer({ ctx }: { ctx: Ctx }) {
  const f = ctx.c.footer;
  const items = ctx.c.contacts.filter((x) => x.placement.startsWith("footer-"));
  const company = ctx.c.header.companyName.trim();
  if (!f.show || (!items.length && !(company && f.companyPosition !== "hidden") && !f.note.trim()))
    return null;
  const band = f.style === "band";
  const bg = band ? ctx.primary : "transparent";
  const fg = band ? onColor(ctx.primary) : ctx.ink;
  const icon = band
    ? onColor(ctx.primary) === "#ffffff"
      ? tint(ctx.secondary, 0.2)
      : ctx.secondary
    : ctx.secondary;
  const fontSize = 10.5 * ctx.s;

  const slot = (name: Align) => {
    const parts: React.ReactNode[] = [];
    if (company && f.companyPosition === name)
      parts.push(
        <span
          key="company"
          style={{ fontWeight: 800, color: band ? fg : ctx.primary, fontSize: fontSize * 0.95 }}
        >
          {company}
        </span>,
      );
    for (const x of items.filter((x) => x.placement === `footer-${name}`))
      parts.push(
        <ContactLine
          key={x.id}
          item={x}
          ctx={ctx}
          color={fg}
          iconColor={icon}
          fontSize={fontSize}
        />,
      );
    if (f.note.trim() && f.notePosition === name)
      parts.push(
        <span
          key="note"
          style={{ fontSize: fontSize * 0.92, color: band ? fg : ctx.muted, fontWeight: 600 }}
        >
          {f.note}
        </span>,
      );
    const justify = name === "left" ? "flex-start" : name === "right" ? "flex-end" : "center";
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: justify,
          alignItems: "center",
          columnGap: 12,
          rowGap: 3,
          minWidth: 0,
        }}
      >
        {parts}
      </div>
    );
  };

  return (
    <div
      style={{
        flexShrink: 0,
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0,1fr))",
        alignItems: "center",
        columnGap: 12,
        minHeight: 34 * ctx.s,
        padding: band ? "8px 14px" : "7px 0 0",
        background: bg,
        borderRadius: band ? ctx.radius : 0,
        borderTop: f.style === "line" ? `2px solid ${ctx.primary}` : undefined,
        boxSizing: "border-box",
      }}
    >
      {slot("left")}
      {slot("center")}
      {slot("right")}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** Rough height of a section, used to balance two-column flows. */
function estimateHeight(sec: SectionConfig, ctx: Ctx, width: number): number {
  const n = sec.fields.filter((f) => f.enabled).length;
  const head = ctx.row * 1.1 + 4;
  switch (sec.id) {
    case "skills":
      return (
        head +
        (sec.style === "chips" ? 2 : Math.ceil(n / (width >= 560 ? 3 : width >= 320 ? 2 : 1))) *
          ctx.row
      );
    case "remarks":
      return head + 60 * ctx.s;
    case "languages":
      return head + (sec.style === "ticks" ? n + 1 : sec.style === "bars" ? n * 1.6 : n) * ctx.row;
    case "experience":
      return head + (sec.style === "table" ? 2 : n) * ctx.row;
    default:
      return (
        head + (sec.style === "grid" ? Math.ceil(n / (width >= 320 ? 2 : 1)) * 1.6 : n) * ctx.row
      );
  }
}

/**
 * Splits sections into two columns of similar height without changing reading order:
 * the first column takes sections until it holds about half.
 */
function splitBalanced(
  secs: SectionConfig[],
  ctx: Ctx,
  width: number,
): [SectionConfig[], SectionConfig[]] {
  const heights = secs.map((s) => estimateHeight(s, ctx, width) + ctx.gap);
  const total = heights.reduce((a, b) => a + b, 0);
  let acc = 0;
  let i = 0;
  for (; i < secs.length; i++) {
    if (i > 0 && acc + heights[i] / 2 > total / 2) break;
    acc += heights[i];
  }
  return [secs.slice(0, i), secs.slice(i)];
}

export interface CustomCvProps {
  d: CvData;
  config: CustomCvConfig;
  /** Same-origin copy of the logo (PDF export); the preview uses the stored URL. */
  logoSrc?: string | null;
}

export function CustomCv({ d, config, logoSrc = null }: CustomCvProps) {
  const t = config.theme;
  const dn = DENSITY[t.density];
  const ctx: Ctx = {
    d,
    c: config,
    s: t.fontScale,
    row: Math.round(dn.row * t.fontScale),
    gap: dn.gap,
    radius: t.corners === "rounded" ? 6 : 0,
    primary: t.primary,
    secondary: t.secondary,
    ink: t.text,
    muted: tint(t.text, 0.35),
    line: tint(t.primary, 0.7),
    labelBg: tint(t.secondary, 0.86),
  };
  const enabled = config.sections.filter((s) => s.enabled);
  const sideSecs = enabled.filter((s) => s.zone === "side");
  const mainSecs = enabled.filter((s) => s.zone === "main");
  const light = surfaceOf(ctx, false);
  const pad = dn.pad;
  const colW = COLUMN_WIDTH_PX[config.columnWidth];
  const font = `'${t.font}', 'Segoe UI', Tahoma, Arial, sans-serif`;
  const border =
    t.pageBorder === "none" ? null : (
      <div
        style={{
          position: "absolute",
          inset: 10,
          border: `${t.pageBorder === "thick" ? 3 : 1}px solid ${t.primary}`,
          borderRadius: ctx.radius,
          pointerEvents: "none",
        }}
      />
    );
  const reverse = config.photoSide === "right";

  // --- Coloured sidebar -----------------------------------------------------
  if (config.structure === "sidebar") {
    const sideW = colW + 26;
    const mainW = PAGE_W - sideW - pad * 2;
    const dark = surfaceOf(ctx, true);
    const photoW = sideW - 32;
    return (
      <Page style={{ background: t.background, fontFamily: font, color: t.text }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            [reverse ? "right" : "left"]: 0,
            width: sideW,
            background: t.primary,
            padding: `${pad}px 16px`,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: ctx.gap,
          }}
        >
          <PhotoArea
            ctx={ctx}
            width={photoW}
            height={PHOTO_HEIGHT[config.photo.size] - 20}
            dark
            direction="column"
          />
          <Zone secs={sideSecs} ctx={ctx} sf={dark} width={photoW} style={{ flex: 1 }} />
        </div>
        <div
          style={{
            position: "absolute",
            top: pad,
            bottom: pad,
            [reverse ? "left" : "right"]: pad,
            width: mainW,
            display: "flex",
            flexDirection: "column",
            gap: ctx.gap,
          }}
        >
          <Header ctx={ctx} width={mainW} logoSrc={logoSrc} />
          <NameBlock ctx={ctx} />
          <Zone secs={mainSecs} ctx={ctx} sf={light} width={mainW} style={{ flex: 1 }} />
          <Footer ctx={ctx} />
        </div>
        {border}
      </Page>
    );
  }

  const contentW = PAGE_W - pad * 2;
  const halfW = Math.floor((contentW - ctx.gap) / 2);
  let body: React.ReactNode;

  if (config.structure === "single" || config.structure === "flow" || config.structure === "hero") {
    // Top block: photo(s) beside the "side" sections. Then the main sections, in one
    // full-width column (single) or two balanced columns (flow, hero).
    const pw = SINGLE_PHOTO_WIDTH[config.photo.size];
    const photoH = Math.round(pw * 1.3) + (config.photo.videoButtons && d.video ? 44 : 0);
    const areaW = photoAreaWidth(ctx, pw);
    const hero = config.structure === "hero";
    const topSf = hero ? surfaceOf(ctx, true) : light;
    const besideW = (hero ? contentW - 28 : contentW) - (areaW ? areaW + ctx.gap : 0);
    const top =
      areaW || sideSecs.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: reverse ? "row-reverse" : "row",
            gap: ctx.gap,
            flexShrink: 0,
            alignItems: "flex-start",
            ...(hero ? { background: t.primary, borderRadius: ctx.radius, padding: 14 } : {}),
          }}
        >
          <PhotoArea ctx={ctx} width={pw} height={photoH} dark={hero} direction="row" />
          <Zone
            secs={sideSecs}
            ctx={ctx}
            sf={topSf}
            width={besideW}
            style={{ flex: 1, maxHeight: 440 }}
          />
        </div>
      ) : null;

    let below: React.ReactNode;
    if (config.structure === "single") {
      below = <Zone secs={mainSecs} ctx={ctx} sf={light} width={contentW} style={{ flex: 1 }} />;
    } else {
      const [colA, colB] = splitBalanced(mainSecs, ctx, halfW);
      below = (
        <div style={{ flex: 1, minHeight: 0, display: "flex", gap: ctx.gap }}>
          <Zone
            secs={colA}
            ctx={ctx}
            sf={light}
            width={halfW}
            style={{ width: halfW, flexShrink: 0 }}
          />
          <Zone
            secs={colB}
            ctx={ctx}
            sf={light}
            width={halfW}
            style={{ width: halfW, flexShrink: 0 }}
          />
        </div>
      );
    }
    body = (
      <div
        style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: ctx.gap }}
      >
        {top}
        {below}
      </div>
    );
  } else {
    // Photo column (fixed width) or two equal halves.
    const colW2 = config.structure === "two-column" ? halfW : colW;
    const mainW = contentW - colW2 - ctx.gap;
    body = (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: reverse ? "row-reverse" : "row",
          gap: ctx.gap,
        }}
      >
        <div
          style={{
            width: colW2,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: ctx.gap,
            minHeight: 0,
          }}
        >
          {/* In a wide half the photo keeps a portrait width, centred. */}
          <div style={{ display: "flex", justifyContent: "center", flexShrink: 0 }}>
            <PhotoArea
              ctx={ctx}
              width={Math.min(colW2, 280)}
              height={PHOTO_HEIGHT[config.photo.size]}
              dark={false}
              direction="column"
            />
          </div>
          <Zone secs={sideSecs} ctx={ctx} sf={light} width={colW2} style={{ flex: 1 }} />
        </div>
        <Zone secs={mainSecs} ctx={ctx} sf={light} width={mainW} style={{ flex: 1 }} />
      </div>
    );
  }

  return (
    <Page style={{ background: t.background, fontFamily: font, color: t.text }}>
      <div
        style={{
          position: "absolute",
          inset: pad,
          display: "flex",
          flexDirection: "column",
          gap: ctx.gap,
          height: PAGE_H - pad * 2,
        }}
      >
        <Header ctx={ctx} width={contentW} logoSrc={logoSrc} />
        <NameBlock ctx={ctx} />
        {body}
        <Footer ctx={ctx} />
      </div>
      {border}
    </Page>
  );
}
