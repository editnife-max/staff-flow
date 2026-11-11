// Custom CV templates → the shared CV render/PDF pipeline (cv-layouts/index.tsx).
import type { Candidate } from "@/lib/docx-fill";
import { downloadCvSpecPdf, ensureWebFont, type CvRenderSpec } from "@/components/cv-layouts";
import { FONTS, type CustomCvConfig } from "./config";
import { CustomCv } from "./renderer";

export function fontOf(config: CustomCvConfig) {
  return FONTS.find((f) => f.family === config.theme.font) ?? FONTS[0];
}

/** Loads the template's font (call before showing a preview). */
export function loadCustomCvFont(config: CustomCvConfig): Promise<void> {
  const f = fontOf(config);
  return ensureWebFont(f.family, f.weights);
}

export function customCvSpec(config: CustomCvConfig): CvRenderSpec {
  const font = fontOf(config);
  const logo = config.header.logoUrl;
  return {
    element: (d, images) => (
      <CustomCv d={d} config={config} logoSrc={logo ? (images.get(logo) ?? null) : null} />
    ),
    font: { family: font.family, weights: font.weights },
    images: logo ? [logo] : [],
  };
}

/** Downloads one candidate's CV in a Custom CV template, with the passport page if the template asks for it. */
export async function downloadCustomCvPdf(
  config: CustomCvConfig,
  c: Candidate,
  filename: string,
): Promise<void> {
  await downloadCvSpecPdf(customCvSpec(config), c, filename, {
    passportUrl: config.attachPassport ? c.passport_scan_url : null,
    videoUrl: config.photo.videoButtons ? c.video_url : null,
  });
}
