// Code-built CV layouts and their PDF export.
//
// Uploaded DOCX templates download fine as DOCX, but no browser-side or API converter
// reproduces Word's layout of their floating text boxes, VML shapes, RTL paragraphs and
// Office fonts, so their PDFs came out misaligned. These layouts recreate each design
// in HTML at exact A4 size; the PDF is a render of the same DOM, so it cannot drift.
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { fetchImgBytes } from "@/lib/docx-fill";
import type { Candidate, CvTemplate } from "@/lib/docx-fill";
import { addPassportScanPage, addVideoLinkPage } from "@/lib/pdf-export";
import { buildCvData, type CvData, type CvPhotos } from "./cv-data";
import { PAGE_H, PAGE_W } from "./primitives";
import { NormalCv, NORMAL_FONT_FAMILY } from "./normal";
import { TadbeerCv } from "./tadbeer";
import { JawaCv } from "./jawa";
import { MonacoCv } from "./monaco";
import { FormatNCv } from "./format-n";

export type CvLayoutId = "normal" | "tadbeer" | "jawa" | "monaco" | "format-n";

interface LayoutDef {
  Component: React.ComponentType<{ d: CvData }>;
  /** Google Fonts family to load before rendering (system fonts need nothing). */
  webFont?: string;
}

const LAYOUTS: Record<CvLayoutId, LayoutDef> = {
  normal: { Component: NormalCv, webFont: NORMAL_FONT_FAMILY },
  tadbeer: { Component: TadbeerCv },
  jawa: { Component: JawaCv },
  monaco: { Component: MonacoCv },
  "format-n": { Component: FormatNCv },
};

/** Built-in "Normal" entry shown alongside the uploaded templates. */
export const NORMAL_CV_OPTION = {
  id: "builtin:normal",
  label: "Normal CV",
  layout: "normal" as CvLayoutId,
};

/** The code layout that replaces an uploaded template's PDF output, matched by template name. */
export function layoutForTemplate(
  template: Pick<CvTemplate, "name"> | null | undefined,
): CvLayoutId | null {
  const name = (template?.name ?? "").toLowerCase();
  if (name.includes("tadbeer")) return "tadbeer";
  if (name.includes("jawa")) return "jawa";
  if (name.includes("monaco")) return "monaco";
  if (/format\s*n\b/.test(name)) return "format-n";
  if (/\bnormal\b/.test(name)) return "normal";
  return null;
}

// Marks <link>/<style> nodes that must survive the stylesheet purge in html2canvas' clone.
const KEEP_ATTR = "data-cv-keep";

async function loadFontWeights(doc: Document, family: string): Promise<void> {
  await Promise.all(
    ["400", "500", "600", "700", "800"].map((w) =>
      doc.fonts.load(`${w} 16px "${family}"`, "Aa عربي").catch(() => []),
    ),
  );
  await doc.fonts.ready;
}

const loadedFonts = new Map<string, Promise<void>>();
function ensureWebFont(family: string): Promise<void> {
  let p = loadedFonts.get(family);
  if (!p) {
    p = (async () => {
      const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700;800&display=block`;
      if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        link.setAttribute(KEEP_ATTR, "");
        await new Promise<void>((res) => {
          link.onload = () => res();
          link.onerror = () => res(); // offline: fall back to the system font stack
          document.head.appendChild(link);
        });
      }
      await loadFontWeights(document, family);
    })();
    loadedFonts.set(family, p);
  }
  return p;
}

/** Fetches a photo into a same-origin blob URL so the canvas is never tainted. */
async function toBlobUrl(src: string | null | undefined, owned: string[]): Promise<string | null> {
  if (!src) return null;
  const img = await fetchImgBytes(src);
  if (!img) return null;
  const url = URL.createObjectURL(
    new Blob([img.bytes as BlobPart], { type: img.ext === "png" ? "image/png" : "image/jpeg" }),
  );
  owned.push(url);
  return url;
}

function preloadBackgrounds(el: HTMLElement): Promise<void> {
  const urls = new Set<string>();
  el.querySelectorAll<HTMLElement>("*").forEach((n) => {
    const m = /url\("?([^")]+)"?\)/.exec(n.style.backgroundImage || "");
    if (m) urls.add(m[1]);
  });
  el.querySelectorAll("img").forEach((img) => urls.add(img.src));
  return Promise.all(
    [...urls].map(
      (u) =>
        new Promise<void>((res) => {
          const i = new Image();
          i.onload = () => res();
          i.onerror = () => res();
          i.src = u;
        }),
    ),
  ).then(() => undefined);
}

/**
 * html2canvas measures each font's baseline in the live document with a 1×1 probe <img>
 * (its SMALL_IMAGE gif). Tailwind's preflight makes every img `display:block`, which
 * skews that measurement and draws all text several px too low, clipping it inside
 * cells. Keep the probe inline while a render runs.
 */
function fixFontMetricsProbe(): () => void {
  const style = document.createElement("style");
  style.textContent = `img[src^="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP"]{display:inline !important}`;
  document.head.appendChild(style);
  return () => style.remove();
}

/** Renders one candidate in the given layout to an A4 canvas (2× scale). */
export async function renderCvLayoutCanvas(
  layout: CvLayoutId,
  c: Candidate,
): Promise<HTMLCanvasElement> {
  const def = LAYOUTS[layout];
  const owned: string[] = [];
  const container = document.createElement("div");
  container.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W}px;height:${PAGE_H}px;`;
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    if (def.webFont) await ensureWebFont(def.webFont);
    const [photo, fullPhoto] = await Promise.all([
      toBlobUrl(c.photo_url ?? c.full_photo_url, owned),
      toBlobUrl(c.full_photo_url ?? c.photo_url, owned),
    ]);
    const photos: CvPhotos = { photo, fullPhoto };
    flushSync(() => root.render(<def.Component d={buildCvData(c, photos)} />));
    const page = container.firstElementChild as HTMLElement;
    await preloadBackgrounds(page);
    await document.fonts.ready;

    const restoreProbe = fixFontMetricsProbe();
    const canvas = await html2canvas(page, {
      scale: 2,
      width: PAGE_W,
      height: PAGE_H,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      onclone: async (doc) => {
        // App stylesheets carry Tailwind oklch colours that html2canvas cannot parse.
        // Layouts use inline styles only; keep just the web-font stylesheet.
        doc
          .querySelectorAll(`link[rel='stylesheet']:not([${KEEP_ATTR}]), style:not([${KEEP_ATTR}])`)
          .forEach((s) => s.remove());
        // html2canvas lays text out in this clone but draws it with the main document's
        // fonts. Load the web font here too (awaited by html2canvas), or words are
        // positioned with a fallback font and drawn overlapping in the real one.
        if (def.webFont) await loadFontWeights(doc, def.webFont);
      },
    }).finally(restoreProbe);
    if (!canvas.width || !canvas.height) throw new Error("CV rendered to a blank page");
    return canvas;
  } finally {
    root.unmount();
    container.remove();
    owned.forEach((u) => URL.revokeObjectURL(u));
  }
}

export interface CvPdfOptions {
  /** Appends the passport scan as page 2. */
  passportUrl?: string | null;
  /** Appends a page linking to the candidate's video CV. */
  videoUrl?: string | null;
}

/** Builds an A4 PDF for one candidate: the CV page, then optional passport and video pages. */
export async function buildCvLayoutPdf(
  layout: CvLayoutId,
  c: Candidate,
  opts: CvPdfOptions = {},
): Promise<jsPDF> {
  const canvas = await renderCvLayoutCanvas(layout, c);
  // px_scaling makes 1px = 0.75pt, so 794×1123px is a true A4 page (595×842pt).
  const pdf = new jsPDF({ unit: "px", format: [PAGE_W, PAGE_H], hotfixes: ["px_scaling"] });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, PAGE_W, PAGE_H);
  if (opts.passportUrl) await addPassportScanPage(pdf, opts.passportUrl);
  if (opts.videoUrl) addVideoLinkPage(pdf, opts.videoUrl);
  return pdf;
}

export async function downloadCvLayoutPdf(
  layout: CvLayoutId,
  c: Candidate,
  filename: string,
  opts: CvPdfOptions = {},
): Promise<void> {
  const pdf = await buildCvLayoutPdf(layout, c, opts);
  pdf.save(filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`);
}
