// Building blocks for code-built CV layouts.
// Everything uses inline styles: the PDF renderer strips the app's stylesheets
// (html2canvas cannot parse Tailwind's oklch colours), so class names would not apply.
// html2canvas also ignores `object-fit`, so photos are drawn as background images.
import React from "react";

/** A4 at 96 dpi. Every layout renders exactly one page of this size. */
export const PAGE_W = 794;
export const PAGE_H = 1123;

export const AR_FONT = "Tahoma, Arial, sans-serif";

export function Page({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      data-cv-page
      style={{
        width: PAGE_W,
        height: PAGE_H,
        position: "relative",
        overflow: "hidden",
        background: "#ffffff",
        color: "#000000",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Right-to-left text span. Never add letter-spacing to Arabic: it breaks letter joining in the PDF. */
export function Ar({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span dir="rtl" style={{ fontFamily: AR_FONT, unicodeBidi: "isolate", ...style }}>
      {children}
    </span>
  );
}

export function PhotoBox({
  src,
  fit = "contain",
  position = "center",
  placeholder,
  style,
}: {
  src: string | null;
  fit?: "contain" | "cover";
  position?: string;
  placeholder?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: "relative",
        boxSizing: "border-box",
        ...style,
        // After `style`, so a `background` shorthand there cannot wipe the image.
        backgroundImage: src ? `url("${src}")` : undefined,
        backgroundSize: fit,
        backgroundPosition: position,
        backgroundRepeat: "no-repeat",
      }}
    >
      {!src && placeholder}
    </div>
  );
}

export interface CellProps {
  /** Left/top/right/bottom edges in page px; right/bottom are inclusive. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  bg?: string;
  align?: "left" | "center" | "right";
  valign?: "top" | "center" | "bottom";
  border?: boolean;
  pad?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Absolutely positioned table cell, used to reproduce Word table geometry measured from
 * the template's own PDF. Neighbouring cells overlap by 1px so shared edges draw as a
 * single line, like a collapsed Word table border.
 */
export function Cell({
  x0,
  y0,
  x1,
  y1,
  bg,
  align = "left",
  valign = "center",
  border = true,
  pad = 4,
  children,
  style,
}: CellProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: x0,
        top: y0,
        width: x1 - x0 + 1,
        height: y1 - y0 + 1,
        boxSizing: "border-box",
        border: border ? "1px solid #000000" : undefined,
        background: bg,
        display: "flex",
        overflow: "hidden",
        flexDirection: "column",
        justifyContent:
          valign === "top" ? "flex-start" : valign === "bottom" ? "flex-end" : "center",
        alignItems: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
        textAlign: align,
        padding: `0 ${pad}px`,
        lineHeight: 1.15,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** A check mark drawn with borders, so it renders without depending on a symbol font. */
export function Tick({
  size = 12,
  color = "#000000",
  weight = 2,
}: {
  size?: number;
  color?: string;
  weight?: number;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        position: "relative",
        verticalAlign: "middle",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: size * 0.32,
          top: size * 0.02,
          width: size * 0.36,
          height: size * 0.72,
          borderRight: `${weight}px solid ${color}`,
          borderBottom: `${weight}px solid ${color}`,
          transform: "rotate(45deg)",
          boxSizing: "border-box",
        }}
      />
    </span>
  );
}
