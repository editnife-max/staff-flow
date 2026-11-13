// Prints an invoice template in its own window. The template is rendered with React
// (so every value is escaped) and copied into a bare document; the browser then
// paginates it, repeating the workers table header on each A4 page.
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function renderToHtml(element: React.ReactElement): string {
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() => root.render(element));
  const html = host.innerHTML;
  root.unmount();
  return html;
}

function whenLoaded(win: Window): Promise<void> {
  const images = Array.from(win.document.images).map((img) =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res();
        }),
  );
  const fonts = win.document.fonts?.ready.then(() => undefined) ?? Promise.resolve();
  // Never wait forever on a slow logo or font.
  const timeout = new Promise<void>((res) => setTimeout(res, 4000));
  return Promise.race([Promise.all([...images, fonts]).then(() => undefined), timeout]);
}

/**
 * Opens the print dialog for an invoice. Call it straight from a click handler: the
 * window is opened synchronously, so popup blockers allow it. Returns false when the
 * browser blocked the window.
 */
export function printInvoice(
  element: React.ReactElement,
  { title, webFont }: { title: string; webFont?: string },
): boolean {
  const win = window.open("", "_blank", "width=1000,height=800");
  if (!win) return false;
  const fontLink = webFont
    ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(webFont)}:wght@400;600;700;800&display=block">`
    : "";
  win.document.open();
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${escapeHtml(title)}</title>
${fontLink}
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#ffffff}
  body{padding:24px 30px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  thead{display:table-header-group}
  tr{break-inside:avoid}
  img{max-width:100%}
  @page{size:A4;margin:12mm}
  @media print{body{padding:0}}
</style></head><body>${renderToHtml(element)}</body></html>`);
  win.document.close();
  win.focus();
  void whenLoaded(win).then(() => {
    win.onafterprint = () => win.close();
    win.print();
  });
  return true;
}
