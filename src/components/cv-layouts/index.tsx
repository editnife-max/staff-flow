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
import type { Candidate, CvTemplate } from "@/lib/docx-fill";
import {
  addPreparedScanPage,
  prefetchImgBytes,
  preparePassportScan,
  takeImgBytes,
} from "@/lib/pdf-export";
import { buildCvData, type CvData, type CvPhotos } from "./cv-data";
import { CV_LINK_ATTR, PAGE_H, PAGE_W } from "./primitives";
import { NormalCv, NORMAL_FONT_FAMILY } from "./normal";
import { NormalClassicCv, NORMAL_CLASSIC_FONT_FAMILY } from "./normal-classic";
import { TadbeerCv } from "./tadbeer";
import { JawaCv } from "./jawa";
import { MonacoCv } from "./monaco";
import { FormatNCv } from "./format-n";

export type CvLayoutId = "normal" | "normal-classic" | "tadbeer" | "jawa" | "monaco" | "format-n";

// Every layout draws Play / Download video buttons under its full-size photo (from
// CvData.video), so their PDFs have no separate video-link page.
interface LayoutDef {
  Component: React.ComponentType<{ d: CvData }>;
  /** Google Fonts family to load before rendering (system fonts need nothing). */
  webFont?: string;
  /** Static images the layout draws (letterheads, logos), warmed up ahead of a download. */
  assets?: string[];
}

const LAYOUTS: Record<CvLayoutId, LayoutDef> = {
  normal: { Component: NormalCv, webFont: NORMAL_FONT_FAMILY },
  "normal-classic": { Component: NormalClassicCv, webFont: NORMAL_CLASSIC_FONT_FAMILY },
  tadbeer: {
    Component: TadbeerCv,
    assets: ["/cv-assets/tadbeer-logo.png", "/cv-assets/tadbeer-flag.png"],
  },
  jawa: {
    Component: JawaCv,
    assets: [
      "/cv-assets/jawa-phone.png",
      "/cv-assets/jawa-whatsapp.png",
      "/cv-assets/jawa-logo.png",
      "/cv-assets/jawa-footer.png",
    ],
  },
  monaco: { Component: MonacoCv, assets: ["/cv-assets/monaco-header.jpg"] },
  "format-n": {
    Component: FormatNCv,
    assets: [
      "/cv-assets/tatweer-logo.png",
      "/cv-assets/tatweer-phone.jpg",
      "/cv-assets/tatweer-whatsapp.jpg",
    ],
  },
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

/** A Google font and the weights to load. Not every family has every weight. */
export interface WebFont {
  family: string;
  weights?: number[];
}

const DEFAULT_WEIGHTS = [400, 500, 600, 700, 800];

async function loadFontWeights(
  doc: Document,
  family: string,
  weights = DEFAULT_WEIGHTS,
): Promise<void> {
  await Promise.all(
    weights.map((w) => doc.fonts.load(`${w} 16px "${family}"`, "Aa عربي").catch(() => [])),
  );
  await doc.fonts.ready;
}

const loadedFonts = new Map<string, Promise<void>>();
/** Loads a Google font once per page (safe to call repeatedly). */
export function ensureWebFont(family: string, weights = DEFAULT_WEIGHTS): Promise<void> {
  const key = `${family}:${weights.join(";")}`;
  let p = loadedFonts.get(key);
  if (!p) {
    p = (async () => {
      const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weights.join(";")}&display=block`;
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
      await loadFontWeights(document, family, weights);
    })();
    loadedFonts.set(key, p);
  }
  return p;
}

const warmedAssets = new Map<string, Promise<void>>();
function warmImage(src: string): Promise<void> {
  let p = warmedAssets.get(src);
  if (!p) {
    p = new Promise<void>((res) => {
      const i = new Image();
      i.onload = () => res();
      i.onerror = () => res();
      i.src = src;
    });
    warmedAssets.set(src, p);
  }
  return p;
}

/**
 * Loads what CV exports need before the first click: web fonts (the slowest step of a
 * first download) and every layout's letterhead images. Safe to call repeatedly.
 */
export function warmUpCvExport(): void {
  for (const def of Object.values(LAYOUTS)) {
    if (def.webFont) void ensureWebFont(def.webFont);
    def.assets?.forEach((a) => void warmImage(a));
  }
}

/**
 * Starts downloading a candidate's photos and passport scan. Bulk exports call this for
 * the next candidate while the current one renders, so its images are ready in time.
 */
export function prefetchCvAssets(c: Candidate): void {
  prefetchImgBytes(c.photo_url ?? c.full_photo_url);
  prefetchImgBytes(c.full_photo_url ?? c.photo_url);
  prefetchImgBytes(c.passport_scan_url);
}

/** Fetches a photo into a same-origin blob URL so the canvas is never tainted. */
async function toBlobUrl(src: string | null | undefined, owned: string[]): Promise<string | null> {
  if (!src) return null;
  const img = await takeImgBytes(src);
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

/** A clickable area on the CV page, in page px. */
interface CvLink {
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Boxes of every element marked with CV_LINK_ATTR, relative to the page. */
function collectLinks(page: HTMLElement): CvLink[] {
  const origin = page.getBoundingClientRect();
  return Array.from(page.querySelectorAll<HTMLElement>(`[${CV_LINK_ATTR}]`)).flatMap((el) => {
    const url = el.getAttribute(CV_LINK_ATTR);
    const r = el.getBoundingClientRect();
    if (!url || !r.width || !r.height) return [];
    return [{ url, x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height }];
  });
}

/**
 * What to render for one CV page. The built-in layouts and Custom CV templates both
 * render through this, so they share one tested PDF path.
 */
export interface CvRenderSpec {
  /** The A4 page. `images` maps each URL in `images` below to a same-origin blob URL. */
  element: (d: CvData, images: Map<string, string | null>) => React.ReactElement;
  font?: WebFont;
  /** Same-origin static images to warm up (letterheads). */
  assets?: string[];
  /** Remote images the page draws (e.g. a company logo), fetched as blob URLs first so the canvas is never tainted. */
  images?: string[];
}

function layoutSpec(layout: CvLayoutId): CvRenderSpec {
  const def = LAYOUTS[layout];
  return {
    element: (d) => <def.Component d={d} />,
    font: def.webFont ? { family: def.webFont } : undefined,
    assets: def.assets,
  };
}

/** Renders one candidate in the given layout to an A4 canvas (2× scale). */
export async function renderCvLayoutCanvas(
  layout: CvLayoutId,
  c: Candidate,
): Promise<HTMLCanvasElement> {
  return (await renderCvSpec(layoutSpec(layout), c)).canvas;
}

/** Renders one candidate with any render spec to an A4 canvas (2× scale). */
export async function renderCvSpecCanvas(
  spec: CvRenderSpec,
  c: Candidate,
): Promise<HTMLCanvasElement> {
  return (await renderCvSpec(spec, c)).canvas;
}

async function renderCvSpec(
  spec: CvRenderSpec,
  c: Candidate,
): Promise<{ canvas: HTMLCanvasElement; links: CvLink[] }> {
  const owned: string[] = [];
  const container = document.createElement("div");
  container.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W}px;height:${PAGE_H}px;`;
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    // Font, photos and letterhead images are independent downloads; fetch them together.
    // The head shot and full photo often fall back to the same URL: download it once.
    const photoSrc = c.photo_url ?? c.full_photo_url;
    const fullSrc = c.full_photo_url ?? c.photo_url;
    const photoP = toBlobUrl(photoSrc, owned);
    const fullP = fullSrc === photoSrc ? photoP : toBlobUrl(fullSrc, owned);
    const imageUrls = [...new Set(spec.images ?? [])];
    const [, , photo, fullPhoto, imageBlobs] = await Promise.all([
      spec.font ? ensureWebFont(spec.font.family, spec.font.weights) : null,
      Promise.all((spec.assets ?? []).map(warmImage)),
      photoP,
      fullP,
      Promise.all(imageUrls.map((u) => toBlobUrl(u, owned))),
    ]);
    const photos: CvPhotos = { photo, fullPhoto };
    const images = new Map(imageUrls.map((u, i) => [u, imageBlobs[i]]));
    flushSync(() => root.render(spec.element(buildCvData(c, photos), images)));
    const page = container.firstElementChild as HTMLElement;
    await preloadBackgrounds(page);
    await document.fonts.ready;
    const links = collectLinks(page);

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
        if (spec.font) await loadFontWeights(doc, spec.font.family, spec.font.weights);
      },
    }).finally(restoreProbe);
    if (!canvas.width || !canvas.height) throw new Error("CV rendered to a blank page");
    return { canvas, links };
  } finally {
    root.unmount();
    container.remove();
    owned.forEach((u) => URL.revokeObjectURL(u));
  }
}

export interface CvPdfOptions {
  /** Appends the passport scan as page 2. */
  passportUrl?: string | null;
  /**
   * The video behind the Play / Download buttons under the full-size photo. Defaults to
   * the candidate's video_url; null hides the buttons.
   */
  videoUrl?: string | null;
}

/** Builds an A4 PDF for one candidate: the CV page, then the optional passport page. */
export async function buildCvLayoutPdf(
  layout: CvLayoutId,
  c: Candidate,
  opts: CvPdfOptions = {},
): Promise<jsPDF> {
  return buildCvSpecPdf(layoutSpec(layout), c, opts);
}

/** Same as buildCvLayoutPdf, for any render spec (used by Custom CV templates). */
export async function buildCvSpecPdf(
  spec: CvRenderSpec,
  c: Candidate,
  opts: CvPdfOptions = {},
): Promise<jsPDF> {
  const cand = opts.videoUrl !== undefined ? { ...c, video_url: opts.videoUrl } : c;
  // Fetch and decode the passport scan while the CV page renders.
  const scanP = opts.passportUrl ? preparePassportScan(opts.passportUrl) : Promise.resolve(null);
  const [{ canvas, links }, scan] = await Promise.all([renderCvSpec(spec, cand), scanP]);

  // px_scaling makes 1px = 0.75pt, so 794×1123px is a true A4 page (595×842pt).
  const pdf = new jsPDF({ unit: "px", format: [PAGE_W, PAGE_H], hotfixes: ["px_scaling"] });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, PAGE_W, PAGE_H);
  for (const l of links) pdf.link(l.x, l.y, l.w, l.h, { url: l.url });
  if (scan) addPreparedScanPage(pdf, scan);
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

export async function downloadCvSpecPdf(
  spec: CvRenderSpec,
  c: Candidate,
  filename: string,
  opts: CvPdfOptions = {},
): Promise<void> {
  const pdf = await buildCvSpecPdf(spec, c, opts);
  pdf.save(filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`);
}
