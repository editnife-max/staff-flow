import type { Candidate } from "./docx-fill";

async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { mode: "cors" });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── Shared builder: fill template (+ optional video QR) ─────────────────────

/**
 * Fills public/normal-cv.docx. `withVideoQr` stamps a QR code for the candidate's video in
 * the top-left corner; the downloads leave it off (the PDF has Play / Download buttons).
 */
async function buildNormalCvDocxBytes(
  c: Candidate,
  { withVideoQr = false }: { withVideoQr?: boolean } = {},
): Promise<Uint8Array> {
  const { buildFilledDocx } = await import("./docx-fill");

  let bytes = await buildFilledDocx(
    { file_url: "/normal-cv.docx", name: "Normal CV" } as any,
    c,
    true,
  );

  if (withVideoQr && c.video_url) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(c.video_url)}`;
    const qrDataUrl = await fetchImageDataUrl(qrUrl);
    if (qrDataUrl) {
      const { default: PizZip } = await import("pizzip");
      const zip = new PizZip(bytes);

      const base64 = qrDataUrl.split(",")[1];
      const qrPng = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
      zip.file("word/media/qr_video.png", qrPng);

      const relsPath = "word/_rels/document.xml.rels";
      let relsXml = zip.file(relsPath)?.asText() ?? "";
      const qrRId = "rQrVideoFlowpath";
      if (!relsXml.includes(`Id="${qrRId}"`)) {
        relsXml = relsXml.replace(
          "</Relationships>",
          `<Relationship Id="${qrRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/qr_video.png"/></Relationships>`,
        );
        zip.file(relsPath, new TextEncoder().encode(relsXml));
      }

      const ctPath = "[Content_Types].xml";
      let ctXml = zip.file(ctPath)?.asText() ?? "";
      if (ctXml && !ctXml.includes('Extension="png"')) {
        ctXml = ctXml.replace(
          "</Types>",
          `<Default Extension="png" ContentType="image/png"/></Types>`,
        );
        zip.file(ctPath, new TextEncoder().encode(ctXml));
      }

      let xml = zip.file("word/document.xml")?.asText() ?? "";
      const sz = 540000; // 1.5 cm × 1.5 cm in EMUs
      const qrPara = [
        `<w:p><w:r><w:drawing>`,
        `<wp:anchor xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"`,
        ` distT="0" distB="0" distL="0" distR="0"`,
        ` simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">`,
        `<wp:simplePos x="0" y="0"/>`,
        `<wp:positionH relativeFrom="margin"><wp:posOffset>0</wp:posOffset></wp:positionH>`,
        `<wp:positionV relativeFrom="margin"><wp:posOffset>0</wp:posOffset></wp:positionV>`,
        `<wp:extent cx="${sz}" cy="${sz}"/>`,
        `<wp:effectExtent l="0" t="0" r="0" b="0"/>`,
        `<wp:wrapNone/>`,
        `<wp:docPr id="9901" name="VideoQR"/>`,
        `<wp:cNvGraphicFramePr>`,
        `<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>`,
        `</wp:cNvGraphicFramePr>`,
        `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">`,
        `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">`,
        `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">`,
        `<pic:nvPicPr><pic:cNvPr id="9901" name="VideoQR"/><pic:cNvPicPr/></pic:nvPicPr>`,
        `<pic:blipFill>`,
        `<a:blip r:embed="${qrRId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>`,
        `<a:stretch><a:fillRect/></a:stretch>`,
        `</pic:blipFill>`,
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${sz}" cy="${sz}"/></a:xfrm>`,
        `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`,
        `</pic:pic></a:graphicData></a:graphic></wp:anchor>`,
        `</w:drawing></w:r></w:p>`,
      ].join("");

      const bodyOpen = xml.indexOf("<w:body>");
      const afterBody = bodyOpen !== -1 ? xml.indexOf(">", bodyOpen) + 1 : 0;
      const insertAt = afterBody > 0 ? afterBody : xml.lastIndexOf("</w:body>");
      xml = xml.slice(0, insertAt) + qrPara + xml.slice(insertAt);

      zip.file("word/document.xml", new TextEncoder().encode(xml));
      bytes = zip.generate({
        type: "uint8array",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
    }
  }

  return bytes;
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

/**
 * Renders the template's design from code (cv-layouts/normal-classic) instead of converting
 * the DOCX: browser DOCX renderers mis-place its tables and RTL labels. Page 1 is the CV
 * with Play / Download video buttons under the photo; page 2 is the passport scan.
 */
export async function downloadNormalCvPdf(c: Candidate): Promise<void> {
  const { downloadCvLayoutPdf } = await import("@/components/cv-layouts");
  await downloadCvLayoutPdf("normal-classic", c, `${c.full_name || "Candidate"} — Normal CV.pdf`, {
    passportUrl: c.passport_scan_url,
    videoUrl: c.video_url,
  });
}

// ─── DOCX ────────────────────────────────────────────────────────────────────

export async function downloadNormalCvDocx(c: Candidate): Promise<void> {
  const { downloadDocx } = await import("./pdf-export");
  const bytes = await buildNormalCvDocxBytes(c);
  downloadDocx(bytes, `${c.full_name || "Candidate"} — Normal CV.docx`);
}

// ─── VIDEO CV PDF ────────────────────────────────────────────────────────────

export async function downloadVideoCvPdf(c: Candidate): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W = 210,
    H = 297;
  const ML = 10;

  const fill = (r: number, g: number, b: number) => doc.setFillColor(r, g, b);
  const pen = (r: number, g: number, b: number) => doc.setDrawColor(r, g, b);
  const ink = (r: number, g: number, b: number) => doc.setTextColor(r, g, b);

  // ── HEADER ──
  fill(26, 58, 82);
  doc.rect(0, 0, W, 22, "F");
  fill(92, 184, 196);
  doc.rect(W / 2, 0, W / 2, 22, "F");
  ink(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("VIDEO CV", ML, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("YOUR TRUSTED PARTNER", ML, 15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("QUALIFIED  ·  RELIABLE  ·  TRUSTWORTHY", W / 2 + 4, 12.5);

  // ── FULL PHOTO ──
  const photoW = 90,
    photoH = 112;
  const photoX = (W - photoW) / 2;
  const photoY = 28;

  const photoDataUrl =
    c.full_photo_url || c.photo_url
      ? await fetchImageDataUrl((c.full_photo_url || c.photo_url)!)
      : null;

  pen(200, 210, 220);
  doc.setLineWidth(0.3);
  if (photoDataUrl) {
    const ext = photoDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
    try {
      doc.addImage(photoDataUrl, ext, photoX, photoY, photoW, photoH);
    } catch {
      /* skip */
    }
    doc.rect(photoX, photoY, photoW, photoH, "S");
  } else {
    fill(240, 242, 245);
    doc.rect(photoX, photoY, photoW, photoH, "FD");
    ink(170, 180, 190);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("NO PHOTO", W / 2, photoY + photoH / 2, { align: "center" });
  }

  // ── NAME ──
  let y = photoY + photoH + 6;
  ink(26, 58, 82);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(c.full_name || "—", W / 2, y, { align: "center" });
  y += 6;

  // ── NATIONALITY · POSITION ──
  ink(100, 120, 140);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const sub = [c.country || "ETHIOPIAN", c.occupation || "HOUSE MAID"]
    .filter(Boolean)
    .join("  ·  ");
  doc.text(sub, W / 2, y, { align: "center" });
  y += 10;

  // ── QR CODE (video link) ──
  if (c.video_url) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(c.video_url)}`;
    const qrDataUrl = await fetchImageDataUrl(qrUrl);
    const qrSz = 45;
    const qrX = (W - qrSz) / 2;

    if (qrDataUrl) {
      const ext = qrDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
      try {
        doc.addImage(qrDataUrl, ext, qrX, y, qrSz, qrSz);
      } catch {
        /* skip */
      }
      pen(200, 210, 220);
      doc.setLineWidth(0.3);
      doc.rect(qrX, y, qrSz, qrSz, "S");
    }
    y += qrSz + 4;

    fill(92, 184, 196);
    ink(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const labelW = 70,
      labelH = 7;
    doc.rect((W - labelW) / 2, y, labelW, labelH, "F");
    doc.text("SCAN TO WATCH VIDEO CV", W / 2, y + 5, { align: "center" });
  }

  // ── FOOTER ──
  fill(26, 58, 82);
  doc.rect(0, H - 9, W, 9, "F");
  ink(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("RECRUITMENT CV  ·  QUALIFIED  ·  RELIABLE  ·  TRUSTWORTHY", W / 2, H - 4, {
    align: "center",
  });

  doc.save(`${c.full_name || "Candidate"} — Video CV.pdf`);
}
