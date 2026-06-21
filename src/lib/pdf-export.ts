import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { renderAsync as docxRenderAsync } from "docx-preview";
import { fetchImgBytes, bytesToDims } from "@/lib/docx-fill";

export async function docxBytesToPdf(bytes: Uint8Array, filename: string, passportUrl?: string, skipPassportPage = false) {
  const container = document.createElement("div");
  container.style.cssText = "position:absolute;top:0;left:-9999px;width:794px;background:#fff;overflow:visible;";
  document.body.appendChild(container);
  try {
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    await docxRenderAsync(buf, container, undefined, {
      className: "docx-pdf-render",
      inWrapper: true,
      ignoreHeight: true,
    });
    // Wait for async images and fonts inside docx-preview to settle
    await new Promise<void>((r) => setTimeout(r, 900));

    const patchOnclone = (_doc: Document) => {
      // Remove app link stylesheets — they contain Tailwind oklch tokens that html2canvas can't parse.
      _doc.querySelectorAll("link[rel='stylesheet']").forEach((s) => s.remove());
      _doc.querySelectorAll("style").forEach((s) => {
        if (s.textContent?.includes("oklch")) {
          s.textContent = s.textContent.replace(/oklch\([^)]*\)/gi, "#000000");
        }
      });
    };

    // docx-preview with inWrapper:true renders one <article> per document page.
    // We render each article separately so multi-page templates (e.g. passport page 2
    // with company header/footer) become individual PDF pages — not a single squished canvas.
    const articles = Array.from(container.querySelectorAll("article")) as HTMLElement[];
    const allPages: HTMLElement[] = articles.length > 0
      ? articles
      : [(container.querySelector(".docx") as HTMLElement) ?? (container.firstElementChild as HTMLElement) ?? container];
    // When passport is added separately, only render page 1 from docx-preview.
    // DOCX templates have a built-in blank page-2 slot; using all articles would include
    // that blank page and push the passport to page 3.
    const pages = passportUrl ? allPages.slice(0, 1) : allPages;

    let pdf: jsPDF | null = null;

    for (const el of pages) {
      const elH = el.scrollHeight || el.offsetHeight;
      if (!elH) continue;
      el.style.height = `${elH}px`;

      const canvas = await html2canvas(el, {
        scale: 2, backgroundColor: "#ffffff", useCORS: true, allowTaint: false, logging: false,
        onclone: patchOnclone,
      });
      const pw = Math.round(canvas.width / 2);
      const ph = Math.round(canvas.height / 2);
      if (!pw || !ph) continue;

      if (!pdf) {
        pdf = new jsPDF({ unit: "px", format: [pw, ph] });
      } else {
        pdf.addPage([pw, ph]);
      }
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, pw, ph);
    }

    if (!pdf) throw new Error("CV template rendered to a blank page — nothing to export");

    // Only append a raw passport page when the DOCX template did not already include one.
    if (!skipPassportPage && passportUrl) await addPassportScanPage(pdf, passportUrl);

    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}

export async function addPassportScanPage(pdf: jsPDF, url: string): Promise<void> {
  // Use fetchImgBytes (fetch-based) so cross-origin restrictions never block the load.
  const fetched = await fetchImgBytes(url);
  if (!fetched) return;

  const dims = await bytesToDims(fetched.bytes);
  const iW   = dims.w || 800;
  const iH   = dims.h || 600;

  // Draw via a local blob URL so the canvas is never tainted by cross-origin restrictions.
  const blobUrl = URL.createObjectURL(
    new Blob([fetched.bytes as BlobPart], { type: fetched.ext === "png" ? "image/png" : "image/jpeg" }),
  );
  let dataUrl: string;
  try {
    const cvs  = document.createElement("canvas");
    cvs.width  = iW;
    cvs.height = iH;
    const imgEl = new Image();
    await new Promise<void>((res, rej) => { imgEl.onload = () => res(); imgEl.onerror = rej; imgEl.src = blobUrl; });
    cvs.getContext("2d")!.drawImage(imgEl, 0, 0);
    dataUrl = cvs.toDataURL("image/jpeg", 0.95);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }

  const isLandscape = iW > iH;
  const pageW = isLandscape ? 1123 : 794;
  const pageH = isLandscape ? 794 : 1123;
  const scale = Math.min((pageW * 0.74) / iW, (pageH * 0.74) / iH);
  const drawW = Math.round(iW * scale);
  const drawH = Math.round(iH * scale);
  const x     = Math.round((pageW - drawW) / 2);
  const y     = Math.round((pageH - drawH) / 2);

  pdf.addPage([pageW, pageH]);
  pdf.addImage(dataUrl, "JPEG", x, y, drawW, drawH);
}

export function downloadDocx(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function canvasToPdf(canvas: HTMLCanvasElement, filename: string, passportUrl?: string): Promise<void> {
  const w = Math.round(canvas.width / 2);
  const h = Math.round(canvas.height / 2);
  const pdf = new jsPDF({ unit: "px", format: [w, h] });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, w, h);
  if (passportUrl) await addPassportScanPage(pdf, passportUrl);
  pdf.save(filename);
}
