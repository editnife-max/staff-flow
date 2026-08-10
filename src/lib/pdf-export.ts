import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { renderAsync as docxRenderAsync } from "docx-preview";
import { fetchImgBytes, bytesToDims } from "@/lib/docx-fill";

// ---------------------------------------------------------------------------
// Cloudmersive DOCX → PDF
// Uses the Cloudmersive Document Conversion API for converting DOCX to PDF.
// ---------------------------------------------------------------------------
export async function convertDocxToPdfViaCloudmersive(
  bytes: Uint8Array,
  filename: string,
): Promise<void> {
  const apiKey = import.meta.env.VITE_CLOUDMERSIVE_API_KEY as string;
  if (!apiKey) throw new Error("VITE_CLOUDMERSIVE_API_KEY is not set");

  const formData = new FormData();
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  formData.append('inputFile', blob, filename.replace(/\.pdf$/i, ".docx"));

  const response = await fetch("https://api.cloudmersive.com/convert/docx/to/pdf", {
    method: 'POST',
    headers: {
      "Apikey": apiKey
    },
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloudmersive conversion failed (${response.status}): ${text}`);
  }

  // Cloudmersive returns the binary PDF file directly in the response
  const pdfBlob = await response.blob();
  const blobUrl = URL.createObjectURL(pdfBlob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
}

// Single-candidate PDF via the browser's native print engine (iframe + window.print()).
// Produces the same quality as Word's "Save as PDF" — vector text, exact A4 size,
// proper pagination — with none of the rasterisation artifacts of html2canvas.
// The user sees the browser print dialog; they choose "Save as PDF" and the filename
// is pre-filled from the iframe's document.title.
export async function docxBytesToPdfPrint(
  bytes: Uint8Array,
  filename: string,
  passportUrl?: string,
  skipPassportPage = false,
): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const blobUrls: string[] = [];

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      blobUrls.forEach((u) => { try { URL.revokeObjectURL(u); } catch {} });
      try { document.body.removeChild(iframe); } catch {}
      resolve();
    };

    (async () => {
      try {
        const iDoc = iframe.contentDocument!;
        const iWin = iframe.contentWindow!;

        iDoc.title = filename;

        const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        await docxRenderAsync(buf, iDoc.body, undefined, {
          className: "docx-pdf-render",
          inWrapper: true,
          ignoreHeight: true,
        });

        // Inject print overrides AFTER docx-preview so our !important rules win
        const style = iDoc.createElement("style");
        style.textContent = `
          @page { margin: 0; size: A4 portrait; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          .docx-wrapper { padding: 0 !important; margin: 0 !important; background: #fff !important; }
          .docx-wrapper > section.docx { box-shadow: none !important; margin: 0 !important; }
          .docx-wrapper > section.docx:not(:last-of-type) { break-after: page; page-break-after: always; }
          .cv-passport-page { break-before: page; page-break-before: always; width: 210mm; height: 297mm;
            display: flex; align-items: center; justify-content: center; background: #fff; }
          .cv-passport-page img { max-width: 74%; max-height: 74%; object-fit: contain; }
        `;
        iDoc.head.appendChild(style);

        if (!skipPassportPage && passportUrl) {
          const img = await fetchImgBytes(passportUrl);
          if (img) {
            const blob = new Blob([img.bytes as BlobPart], {
              type: img.ext === "png" ? "image/png" : "image/jpeg",
            });
            const blobUrl = URL.createObjectURL(blob);
            blobUrls.push(blobUrl);
            const pageDiv = iDoc.createElement("div");
            pageDiv.className = "cv-passport-page";
            const imgEl = iDoc.createElement("img");
            imgEl.src = blobUrl;
            await new Promise<void>((r) => {
              imgEl.onload = () => r();
              imgEl.onerror = () => r();
              setTimeout(r, 3000);
            });
            pageDiv.appendChild(imgEl);
            iDoc.body.appendChild(pageDiv);
          }
        }

        // Give images / fonts inside docx-preview time to fully render
        await new Promise<void>((r) => setTimeout(r, 1000));

        // Safety net: clean up if afterprint never fires (e.g. dialog left open for 10 min)
        const fallback = setTimeout(cleanup, 10 * 60 * 1000);
        iWin.addEventListener("afterprint", () => { clearTimeout(fallback); cleanup(); }, { once: true });

        iWin.print();
      } catch (e) {
        cleanup();
        reject(e);
      }
    })();
  });
}

function addVideoLinkPage(pdf: jsPDF, videoUrl: string): void {
  pdf.addPage([794, 1123]);
  pdf.setFontSize(20);
  pdf.setTextColor(26, 58, 82);
  pdf.text("Video CV", 397, 200, { align: "center" });
  pdf.setFontSize(12);
  pdf.setTextColor(100, 100, 100);
  pdf.text("Watch the video interview:", 397, 270, { align: "center" });
  pdf.setFontSize(11);
  pdf.setTextColor(5, 99, 193);
  const label = videoUrl.length > 90 ? videoUrl.slice(0, 87) + "…" : videoUrl;
  const lw = pdf.getTextWidth(label);
  const lx = 397 - lw / 2;
  const ly = 310;
  pdf.text(label, lx, ly);
  pdf.link(lx, ly - 14, lw, 18, { url: videoUrl });
}

export async function docxBytesToPdf(bytes: Uint8Array, filename: string, passportUrl?: string, skipPassportPage = false, videoUrl?: string) {
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
    if (videoUrl) addVideoLinkPage(pdf, videoUrl);

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
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function canvasToPdf(canvas: HTMLCanvasElement, filename: string, passportUrl?: string, videoUrl?: string): Promise<void> {
  const w = Math.round(canvas.width / 2);
  const h = Math.round(canvas.height / 2);
  const pdf = new jsPDF({ unit: "px", format: [w, h] });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, w, h);
  if (passportUrl) await addPassportScanPage(pdf, passportUrl);
  if (videoUrl) addVideoLinkPage(pdf, videoUrl);
  pdf.save(filename);
}
