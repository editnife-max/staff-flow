// Invoice templates, one per CV design. Every template prints the same bilingual body
// (details, parties, workers, totals, payment, signatures); a template sets the
// letterhead, footer, colours, fonts and cell style so it matches its CV.
//
// Inline styles only: the same markup is shown in the editor and written into a bare
// print window, where the app's stylesheets do not exist. Widths are fluid so the browser
// can paginate long worker lists (the table header repeats on every printed page).
import React from "react";
import { onColor, tint, type CustomCvConfig } from "@/components/custom-cv/config";
import { ContactIcon } from "@/components/custom-cv/icons";
import {
  CUSTOM_INVOICE_PREFIX,
  fmtInvoiceDate,
  fmtMoney,
  type BuiltinInvoiceTemplate,
  type InvoiceData,
  type InvoiceTemplateOption,
} from "./data";

type Labels = "bilingual" | "english" | "arabic";

/** Colours, fonts and cell style of a template. */
interface Skin {
  font: string;
  /** Font of printed values (names, numbers). */
  valueFont: string;
  arFont: string;
  ink: string;
  muted: string;
  /** Cell borders. */
  line: string;
  /** Title bars and table headers. */
  headBg: string;
  /** Text on headBg / totalBg when the automatic contrast pick is not the template's. */
  headText?: string;
  /** Label cells. */
  labelBg: string;
  /** Titles and emphasised text. */
  accent: string;
  /** The Total Due row. */
  totalBg: string;
  radius: number;
  /** Form look (black-ruled cells, like the TADBEER form) instead of soft cards. */
  ruled: boolean;
  labels: Labels;
  /** The letterhead already carries the INVOICE title. */
  titleInHeader: boolean;
  /** Google Fonts family to load for printing, if any. */
  webFont?: string;
}

// ---------------------------------------------------------------------------
// Shared body
// ---------------------------------------------------------------------------

function Ar({
  children,
  skin,
  style,
}: {
  children: React.ReactNode;
  skin: Skin;
  style?: React.CSSProperties;
}) {
  return (
    <span dir="rtl" style={{ fontFamily: skin.arFont, unicodeBidi: "isolate", ...style }}>
      {children}
    </span>
  );
}

/** A label in the template's language mode. `stack` puts the Arabic under the English. */
function Label({
  en,
  ar,
  skin,
  stack = false,
  arStyle,
}: {
  en: string;
  ar: string;
  skin: Skin;
  stack?: boolean;
  arStyle?: React.CSSProperties;
}) {
  if (skin.labels === "english") return <span>{en}</span>;
  if (skin.labels === "arabic")
    return (
      <Ar skin={skin} style={arStyle}>
        {ar}
      </Ar>
    );
  return (
    <span
      style={{
        display: "flex",
        flexDirection: stack ? "column" : "row",
        justifyContent: "space-between",
        alignItems: stack ? "flex-start" : "center",
        gap: stack ? 1 : 8,
        width: "100%",
      }}
    >
      <span>{en}</span>
      <Ar skin={skin} style={{ fontWeight: 600, ...arStyle }}>
        {ar}
      </Ar>
    </span>
  );
}

function headFg(skin: Skin): string {
  return skin.headText ?? onColor(skin.headBg);
}

/** A section title bar: English left, Arabic right. */
function Bar({ en, ar, skin }: { en: string; ar: string; skin: Skin }) {
  return (
    <div
      style={{
        background: skin.headBg,
        color: headFg(skin),
        padding: "5px 9px",
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: skin.labels === "arabic" ? 0 : 0.4,
        border: skin.ruled ? `1px solid ${skin.line}` : undefined,
        borderRadius: skin.radius ? `${skin.radius}px ${skin.radius}px 0 0` : 0,
      }}
    >
      <Label en={en.toUpperCase()} ar={ar} skin={skin} arStyle={{ fontSize: 12.5 }} />
    </div>
  );
}

function boxStyle(skin: Skin): React.CSSProperties {
  return {
    border: `1px solid ${skin.line}`,
    borderTop: "none",
    borderRadius: skin.radius ? `0 0 ${skin.radius}px ${skin.radius}px` : 0,
    background: "#ffffff",
  };
}

/** label | value | (Arabic label) rows, the TADBEER row pattern. */
function DetailRows({
  rows,
  skin,
}: {
  rows: Array<{ en: string; ar: string; value: React.ReactNode }>;
  skin: Skin;
}) {
  const cols =
    skin.labels === "bilingual"
      ? "minmax(0,1fr) minmax(0,1.25fr) minmax(0,0.9fr)"
      : "minmax(0,1fr) minmax(0,1.6fr)";
  return (
    <div
      style={{ border: `1px solid ${skin.line}`, borderRadius: skin.radius, overflow: "hidden" }}
    >
      {rows.map((r, i) => (
        <div
          key={r.en}
          style={{
            display: "grid",
            gridTemplateColumns: cols,
            minHeight: 26,
            borderTop: i ? `1px solid ${skin.line}` : undefined,
          }}
        >
          <div
            style={{
              background: skin.labelBg,
              color: onColor(skin.labelBg, skin.ink),
              padding: "4px 8px",
              fontSize: 10.5,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              borderRight: `1px solid ${skin.line}`,
            }}
          >
            {skin.labels === "arabic" ? <Ar skin={skin}>{r.ar}</Ar> : r.en}
          </div>
          <div
            style={{
              padding: "4px 8px",
              fontFamily: skin.valueFont,
              fontSize: 12.5,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: skin.ruled ? "center" : "flex-start",
              color: skin.ink,
            }}
          >
            {r.value || "—"}
          </div>
          {skin.labels === "bilingual" && (
            <div
              style={{
                background: skin.labelBg,
                color: onColor(skin.labelBg, skin.ink),
                padding: "4px 8px",
                fontSize: 11.5,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                borderLeft: `1px solid ${skin.line}`,
              }}
            >
              <Ar skin={skin}>{r.ar}</Ar>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Party({
  en,
  ar,
  lines,
  skin,
}: {
  en: string;
  ar: string;
  lines: Array<{ text: string; strong?: boolean }>;
  skin: Skin;
}) {
  const shown = lines.filter((l) => l.text.trim());
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <Bar en={en} ar={ar} skin={skin} />
      <div
        style={{
          ...boxStyle(skin),
          flex: 1,
          padding: "8px 10px",
          fontSize: 12,
          lineHeight: 1.55,
          minHeight: 64,
          whiteSpace: "pre-line",
          wordBreak: "break-word",
        }}
      >
        {shown.length === 0 ? (
          <span style={{ color: skin.muted }}>—</span>
        ) : (
          shown.map((l, i) => (
            <div
              key={i}
              style={
                l.strong
                  ? {
                      fontWeight: 800,
                      fontSize: 13,
                      color: skin.accent,
                      fontFamily: skin.valueFont,
                    }
                  : { color: skin.ink }
              }
            >
              {l.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const WORKER_COLS: Array<{ en: string; ar: string; width?: string; align?: "center" }> = [
  { en: "#", ar: "م", width: "34px", align: "center" },
  { en: "Worker Name", ar: "اسم العامل" },
  { en: "Passport No.", ar: "رقم الجواز", width: "17%" },
  { en: "Travel Date", ar: "تاريخ السفر", width: "16%" },
  { en: "Profession", ar: "المهنة", width: "19%" },
];

function WorkersTable({ d, skin }: { d: InvoiceData; skin: Skin }) {
  const fg = headFg(skin);
  const cell: React.CSSProperties = {
    border: `1px solid ${skin.line}`,
    padding: "5px 7px",
    fontSize: 12,
    verticalAlign: "middle",
  };
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        tableLayout: "fixed",
        color: skin.ink,
      }}
    >
      <colgroup>
        {WORKER_COLS.map((c) => (
          <col key={c.en} style={c.width ? { width: c.width } : undefined} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {WORKER_COLS.map((c) => (
            <th
              key={c.en}
              style={{
                ...cell,
                background: skin.headBg,
                color: fg,
                fontSize: 10.5,
                fontWeight: 700,
                textAlign: c.align ?? "left",
                lineHeight: 1.25,
              }}
            >
              {c.en === "#" ? (
                "#"
              ) : skin.labels === "english" ? (
                c.en
              ) : skin.labels === "arabic" ? (
                <Ar skin={skin}>{c.ar}</Ar>
              ) : (
                <span style={{ display: "flex", flexDirection: "column" }}>
                  <span>{c.en}</span>
                  <Ar skin={skin} style={{ fontSize: 11, fontWeight: 600 }}>
                    {c.ar}
                  </Ar>
                </span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {d.workers.length === 0 && (
          <tr>
            <td
              colSpan={WORKER_COLS.length}
              style={{ ...cell, textAlign: "center", color: skin.muted }}
            >
              —
            </td>
          </tr>
        )}
        {d.workers.map((w, i) => (
          <tr
            key={w.id}
            style={{
              breakInside: "avoid",
              background: !skin.ruled && i % 2 ? tint(skin.headBg, 0.95) : "#ffffff",
            }}
          >
            <td style={{ ...cell, textAlign: "center", color: skin.muted }}>{i + 1}</td>
            <td style={{ ...cell, fontWeight: 700, fontFamily: skin.valueFont }}>{w.name}</td>
            <td style={{ ...cell, fontFamily: skin.valueFont }}>{w.passport || "—"}</td>
            <td style={cell}>{w.travelDate ? fmtInvoiceDate(w.travelDate) : "—"}</td>
            <td style={cell}>{w.profession || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Totals({ d, skin }: { d: InvoiceData; skin: Skin }) {
  const rows: Array<{ en: string; ar: string; value: string; total?: boolean }> = [
    {
      en: `Recruitment fee (${d.workers.length} × ${fmtMoney(d.feeEach)})`,
      ar: "رسوم الاستقدام",
      value: fmtMoney(d.subtotal, d.currency),
    },
    { en: "Other expenses", ar: "مصاريف أخرى", value: fmtMoney(d.otherExpenses, d.currency) },
    { en: "Total Due", ar: "المبلغ المستحق", value: fmtMoney(d.total, d.currency), total: true },
  ];
  return (
    <div
      style={{
        border: `1px solid ${skin.line}`,
        borderRadius: skin.radius,
        overflow: "hidden",
        breakInside: "avoid",
      }}
    >
      {rows.map((r, i) => {
        const bg = r.total
          ? skin.totalBg
          : i % 2
            ? "#ffffff"
            : skin.ruled
              ? "#ffffff"
              : tint(skin.headBg, 0.95);
        const fg = r.total ? (skin.headText ?? onColor(skin.totalBg)) : skin.ink;
        return (
          <div
            key={r.ar}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: r.total ? "8px 10px" : "6px 10px",
              background: bg,
              color: fg,
              borderTop: i ? `1px solid ${skin.line}` : undefined,
              fontSize: r.total ? 13.5 : 12,
              fontWeight: r.total ? 800 : 600,
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <Label en={r.en} ar={r.ar} skin={skin} stack />
            </span>
            <span
              style={{
                fontFamily: skin.valueFont,
                fontWeight: 800,
                fontSize: r.total ? 15 : 12.5,
                whiteSpace: "nowrap",
              }}
            >
              {r.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Signatures({ skin }: { skin: Skin }) {
  return (
    <div style={{ display: "flex", gap: 40, marginTop: 34, breakInside: "avoid" }}>
      {[
        ["Authorized Signature", "التوقيع المعتمد"],
        ["Company Stamp", "ختم الشركة"],
      ].map(([en, ar]) => (
        <div key={en} style={{ flex: 1 }}>
          <div style={{ borderBottom: `1px solid ${skin.ink}`, height: 34 }} />
          <div style={{ marginTop: 5, fontSize: 10.5, fontWeight: 700, color: skin.muted }}>
            <Label en={en} ar={ar} skin={skin} />
          </div>
        </div>
      ))}
    </div>
  );
}

function InvoiceBody({ d, skin }: { d: InvoiceData; skin: Skin }) {
  const period = d.periodFrom
    ? `${fmtInvoiceDate(d.periodFrom)}${d.periodTo ? ` – ${fmtInvoiceDate(d.periodTo)}` : ""}`
    : "";
  const meta = [
    { en: "Invoice No.", ar: "رقم الفاتورة", value: d.number },
    { en: "Invoice Date", ar: "تاريخ الفاتورة", value: fmtInvoiceDate(d.date) },
    { en: "Due Date", ar: "تاريخ الاستحقاق", value: fmtInvoiceDate(d.dueDate) },
    { en: "Period", ar: "الفترة", value: period },
  ];
  const payment = [
    { en: "Payment", ar: "طريقة الدفع", value: d.payment.name },
    { en: "Account No.", ar: "رقم الحساب", value: d.payment.account },
    { en: "Terms", ar: "شروط الدفع", value: d.terms },
  ].filter((r) => r.value.trim());
  const gap = 14;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {!skin.titleInHeader && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: skin.headBg,
            color: headFg(skin),
            borderRadius: skin.radius,
            padding: "8px 14px",
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: 3 }}>
            {skin.labels === "arabic" ? "" : "INVOICE"}
          </span>
          {skin.labels !== "english" && (
            <Ar skin={skin} style={{ fontSize: 22, fontWeight: 800 }}>
              فاتورة
            </Ar>
          )}
        </div>
      )}

      {/* Invoice details: two tables side by side */}
      <div style={{ display: "flex", gap }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <DetailRows rows={meta.slice(0, 2)} skin={skin} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <DetailRows rows={meta.slice(2)} skin={skin} />
        </div>
      </div>

      {/* Parties */}
      <div style={{ display: "flex", gap }}>
        <Party
          en="Invoice From"
          ar="الفاتورة من"
          skin={skin}
          lines={[
            { text: d.from.company, strong: true },
            { text: d.from.address },
            { text: d.from.phone ? `Tel: ${d.from.phone}` : "" },
            { text: d.from.email },
          ]}
        />
        <Party
          en="Bill To"
          ar="فاتورة إلى"
          skin={skin}
          lines={[
            { text: d.company, strong: true },
            { text: d.billTo && d.billTo !== d.company ? d.billTo : "" },
          ]}
        />
      </div>

      {/* Workers */}
      <div>
        <Bar en={`Workers (${d.workers.length})`} ar="العمالة" skin={skin} />
        <WorkersTable d={d} skin={skin} />
      </div>

      {/* Payment details + totals */}
      <div style={{ display: "flex", gap, alignItems: "flex-start", breakInside: "avoid" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {payment.length > 0 && (
            <>
              <Bar en="Payment Details" ar="بيانات الدفع" skin={skin} />
              <DetailRows rows={payment} skin={{ ...skin, radius: 0 }} />
            </>
          )}
        </div>
        <div style={{ width: "46%", flexShrink: 0 }}>
          <Totals d={d} skin={skin} />
        </div>
      </div>

      <Signatures skin={skin} />

      <div
        style={{
          textAlign: "center",
          fontSize: 12,
          fontWeight: 700,
          color: skin.accent,
          marginTop: 4,
        }}
      >
        <Label en="Thank you for your business" ar="شكراً لتعاملكم معنا" skin={skin} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Letterheads and footers
// ---------------------------------------------------------------------------

/** Absolute URL for a static asset, so it also loads inside the print window. */
function asset(path: string): string {
  return typeof window === "undefined" ? path : `${window.location.origin}${path}`;
}

function TitleStack({
  color,
  size = 26,
  arFont,
  align = "center",
}: {
  color: string;
  size?: number;
  arFont: string;
  align?: "center" | "flex-end" | "flex-start";
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align,
        color,
        lineHeight: 1.15,
      }}
    >
      <span
        dir="rtl"
        style={{ fontFamily: arFont, fontSize: size, fontWeight: 700, unicodeBidi: "isolate" }}
      >
        فاتورة
      </span>
      <span style={{ fontSize: size * 0.52, fontWeight: 800, letterSpacing: 4 }}>INVOICE</span>
    </div>
  );
}

interface Design {
  skin: Skin;
  header: (d: InvoiceData) => React.ReactNode;
  footer?: (d: InvoiceData) => React.ReactNode;
  /** Frame drawn around the whole document (Monaco). */
  frame?: string;
}

const AR_SANS = "Tahoma, Arial, sans-serif";

const BUILTIN: Record<BuiltinInvoiceTemplate, Design> = {
  standard: {
    skin: {
      font: "Arial, Helvetica, sans-serif",
      valueFont: "Arial, Helvetica, sans-serif",
      arFont: AR_SANS,
      ink: "#111827",
      muted: "#6b7280",
      line: "#d1d5db",
      headBg: "#1a3a52",
      labelBg: "#eef6f8",
      accent: "#1a3a52",
      totalBg: "#1a3a52",
      radius: 0,
      ruled: false,
      labels: "bilingual",
      titleInHeader: true,
    },
    header: (d) => (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderBottom: "2.5px solid #1a3a52",
          paddingBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1a3a52" }}>
            {d.from.company || "Staff-Flow"}
          </div>
          <div style={{ fontSize: 10.5, color: "#6b7280", marginTop: 2 }}>
            Recruitment &amp; Placement Agency
          </div>
        </div>
        <TitleStack color="#1a3a52" arFont={AR_SANS} align="flex-end" />
      </div>
    ),
  },

  tadbeer: {
    skin: {
      font: "Arial, sans-serif",
      valueFont: "'Times New Roman', Times, serif",
      arFont: "Arial, Tahoma, sans-serif",
      ink: "#000000",
      muted: "#374151",
      line: "#000000",
      headBg: "#365f91",
      labelBg: "#8db3e0",
      accent: "#006fc0",
      totalBg: "#365f91",
      radius: 0,
      ruled: true,
      labels: "bilingual",
      titleInHeader: true,
    },
    header: () => (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          paddingBottom: 6,
        }}
      >
        <img
          src={asset("/cv-assets/tadbeer-logo.png")}
          alt=""
          style={{ width: 186, maxWidth: "100%", height: "auto" }}
        />
        <TitleStack color="#006fc0" arFont="'Times New Roman', Arial, serif" size={28} />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <img
            src={asset("/cv-assets/tadbeer-flag.png")}
            alt=""
            style={{ width: 104, height: "auto" }}
          />
        </div>
      </div>
    ),
  },

  jawa: {
    skin: {
      font: "Verdana, Tahoma, Arial, sans-serif",
      valueFont: "'Times New Roman', Times, serif",
      arFont: "Tahoma, Arial, sans-serif",
      ink: "#000000",
      muted: "#4b5563",
      line: "#000000",
      headBg: "#e8e8e8",
      labelBg: "#e8e8e8",
      accent: "#996633",
      totalBg: "#996633",
      radius: 0,
      ruled: true,
      labels: "bilingual",
      titleInHeader: false,
    },
    header: () => (
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {["/cv-assets/jawa-phone.png", "/cv-assets/jawa-whatsapp.png"].map((src) => (
            <div key={src} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src={asset(src)} alt="" style={{ width: 28, height: 28 }} />
              <span
                style={{
                  color: "#996633",
                  fontFamily: "Ebrima, 'Segoe UI', Arial, sans-serif",
                  fontWeight: 700,
                  fontSize: 17,
                }}
              >
                +966 55132 7872
              </span>
            </div>
          ))}
        </div>
        <img
          src={asset("/cv-assets/jawa-logo.png")}
          alt=""
          style={{ width: 400, maxWidth: "58%", height: "auto" }}
        />
      </div>
    ),
    footer: () => (
      <img
        src={asset("/cv-assets/jawa-footer.png")}
        alt=""
        style={{ width: "100%", height: "auto", display: "block" }}
      />
    ),
  },

  monaco: {
    skin: {
      font: "Cambria, Georgia, 'Times New Roman', serif",
      valueFont: "'Times New Roman', Times, serif",
      arFont: "'Times New Roman', Arial, serif",
      ink: "#000000",
      muted: "#4b5563",
      line: "#000000",
      headBg: "#9bba58",
      headText: "#ffffff",
      labelBg: "#ebf1de",
      accent: "#4f6228",
      totalBg: "#9bba58",
      radius: 0,
      ruled: true,
      labels: "bilingual",
      titleInHeader: false,
    },
    frame: "1px solid #000000",
    header: () => (
      <div style={{ display: "flex", justifyContent: "center" }}>
        <img
          src={asset("/cv-assets/monaco-header.jpg")}
          alt=""
          style={{ width: 600, maxWidth: "100%", height: "auto" }}
        />
      </div>
    ),
  },

  "format-n": {
    skin: {
      font: "Dubai, 'Segoe UI', Tahoma, Arial, sans-serif",
      valueFont: "Dubai, 'Segoe UI', Tahoma, Arial, sans-serif",
      arFont: "Dubai, 'Segoe UI', Tahoma, Arial, sans-serif",
      ink: "#1f2937",
      muted: "#747474",
      line: "#c9ccd1",
      headBg: "#074f6a",
      labelBg: "#f6eef1",
      accent: "#a42449",
      totalBg: "#a42449",
      radius: 0,
      ruled: false,
      labels: "bilingual",
      titleInHeader: true,
    },
    header: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: 12,
            color: "#747474",
          }}
        >
          <div style={{ textAlign: "center", fontSize: 19, lineHeight: 1.45 }}>
            Tatweer Human
            <br />
            Resources Company
          </div>
          <img
            src={asset("/cv-assets/tatweer-logo.png")}
            alt=""
            style={{ width: 66, height: "auto" }}
          />
          <div
            dir="rtl"
            style={{ textAlign: "center", fontSize: 22, lineHeight: 1.45, unicodeBidi: "isolate" }}
          >
            شركة تطوير الأيدي
            <br />
            العاملة للاستقدام
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "0 70px",
            color: "#4c94d8",
            fontSize: 20,
          }}
        >
          <span style={{ borderBottom: "1px solid #4b93d7", lineHeight: "30px" }}>Invoice</span>
          <span
            dir="rtl"
            style={{
              borderBottom: "1px solid #4b93d7",
              lineHeight: "30px",
              unicodeBidi: "isolate",
            }}
          >
            فاتورة
          </span>
        </div>
      </div>
    ),
    footer: () => (
      <div style={{ borderTop: "3px solid #215e99", paddingTop: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-evenly",
            color: "#215e99",
            fontSize: 18,
          }}
        >
          <span>For contact</span>
          <img
            src={asset("/cv-assets/tatweer-phone.jpg")}
            alt=""
            style={{ width: 30, height: 26 }}
          />
          <span>920020006</span>
          <img
            src={asset("/cv-assets/tatweer-whatsapp.jpg")}
            alt=""
            style={{ width: 25, height: 26 }}
          />
          <span dir="rtl" style={{ unicodeBidi: "isolate" }}>
            للتواصل
          </span>
        </div>
      </div>
    ),
  },

  normal: {
    skin: {
      font: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif",
      valueFont: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif",
      arFont: "'Cairo', Tahoma, Arial, sans-serif",
      ink: "#1d3f63",
      muted: "#8d9aa8",
      line: "#9fdde3",
      headBg: "#174a6b",
      labelBg: "#eef8fa",
      accent: "#174a6b",
      totalBg: "#2a9da6",
      radius: 6,
      ruled: false,
      labels: "bilingual",
      titleInHeader: true,
      webFont: "Cairo",
    },
    header: (d) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#174a6b" }}>
            {d.from.company || "Recruitment Agency"}
          </div>
          <div
            style={{
              background: "#174a6b",
              color: "#ffffff",
              borderRadius: 6,
              padding: "6px 22px",
              textAlign: "center",
              lineHeight: 1.3,
            }}
          >
            <div dir="rtl" style={{ fontSize: 16, fontWeight: 700, unicodeBidi: "isolate" }}>
              فاتورة
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2 }}>INVOICE</div>
          </div>
        </div>
        <div style={{ display: "flex", height: 7, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: "35%", background: "#b5196f" }} />
          <div style={{ width: "22%", background: "#f47f4f" }} />
          <div style={{ flex: 1, background: "#58cdd2" }} />
        </div>
      </div>
    ),
  },

  "normal-classic": {
    skin: {
      font: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif",
      valueFont: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif",
      arFont: "'Cairo', Tahoma, Arial, sans-serif",
      ink: "#1E2A24",
      muted: "#7A8A80",
      line: "#CFE3D6",
      headBg: "#1F6B45",
      labelBg: "#EAF4EE",
      accent: "#1F6B45",
      totalBg: "#1F6B45",
      radius: 4,
      ruled: false,
      labels: "bilingual",
      titleInHeader: true,
      webFont: "Cairo",
    },
    header: (d) => (
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 34,
            fontWeight: 800,
            color: "#1F6B45",
            letterSpacing: 2,
            lineHeight: 1.2,
          }}
        >
          INVOICE{" "}
          <span dir="rtl" style={{ unicodeBidi: "isolate" }}>
            فاتورة
          </span>
        </div>
        {d.from.company && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#7A8A80",
              letterSpacing: 2.5,
              marginTop: 4,
            }}
          >
            {d.from.company.toUpperCase()}
          </div>
        )}
        <div style={{ height: 3, background: "#1F6B45", borderRadius: 2, marginTop: 10 }} />
      </div>
    ),
  },
};

/** An invoice in a Custom CV template's branding: its colours, font, header and contacts. */
function customDesign(c: CustomCvConfig): Design {
  const t = c.theme;
  const h = c.header;
  const radius = t.corners === "rounded" ? 6 : 0;
  const font = `'${t.font}', 'Segoe UI', Tahoma, Arial, sans-serif`;
  const skin: Skin = {
    font,
    valueFont: font,
    arFont: font,
    ink: t.text,
    muted: tint(t.text, 0.35),
    line: tint(t.primary, 0.7),
    headBg: t.primary,
    labelBg: tint(t.secondary, 0.86),
    accent: t.primary,
    totalBg: t.secondary,
    radius,
    ruled: false,
    labels: t.labels,
    titleInHeader: true,
    webFont: t.font,
  };
  const band = h.style === "band";
  const fg = band ? onColor(t.primary) : t.primary;
  const titleRight = h.titlePosition !== "left";
  const brand = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      {h.logoUrl && h.logoPosition !== "hidden" && (
        <img src={h.logoUrl} alt="" style={{ height: 58, maxWidth: 170, objectFit: "contain" }} />
      )}
      <div style={{ minWidth: 0 }}>
        {h.companyName && (
          <div style={{ fontSize: 20, fontWeight: 800, color: fg, lineHeight: 1.15 }}>
            {h.companyName}
          </div>
        )}
        {h.companyNameAr && (
          <div
            dir="rtl"
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: fg,
              opacity: 0.9,
              unicodeBidi: "isolate",
            }}
          >
            {h.companyNameAr}
          </div>
        )}
        {h.tagline && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: band ? tint(t.secondary, 0.25) : t.secondary,
              letterSpacing: 1,
            }}
          >
            {h.tagline}
          </div>
        )}
      </div>
    </div>
  );
  const title = (
    <TitleStack color={fg} arFont={font} size={24} align={titleRight ? "flex-end" : "flex-start"} />
  );
  return {
    skin,
    header: () => (
      <div
        style={{
          display: "flex",
          flexDirection: titleRight ? "row" : "row-reverse",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          padding: h.style === "plain" ? "0 0 10px" : "12px 16px",
          background: band ? t.primary : "transparent",
          border: h.style === "outline" ? `2px solid ${t.primary}` : undefined,
          borderBottom: h.style === "plain" ? `3px solid ${t.primary}` : undefined,
          borderRadius: h.style === "plain" ? 0 : radius,
        }}
      >
        {brand}
        {title}
      </div>
    ),
    footer: () => {
      if (!c.contacts.length && !c.footer.note.trim()) return null;
      return (
        <div
          style={{
            borderTop: `2px solid ${t.primary}`,
            paddingTop: 8,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            columnGap: 16,
            rowGap: 4,
            fontSize: 10.5,
            color: t.text,
          }}
        >
          {c.contacts.map((x) => (
            <span
              key={x.id}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600 }}
            >
              <ContactIcon kind={x.kind} size={12} color={t.secondary} />
              {x.label && <b>{x.label}:</b>}
              {x.value}
            </span>
          ))}
          {c.footer.note.trim() && (
            <span style={{ color: tint(t.text, 0.35) }}>{c.footer.note}</span>
          )}
        </div>
      );
    },
  };
}

function designOf(template: InvoiceTemplateOption | undefined): Design {
  if (template?.id.startsWith(CUSTOM_INVOICE_PREFIX) && template.config)
    return customDesign(template.config);
  const id = (template?.id ?? "standard") as BuiltinInvoiceTemplate;
  return BUILTIN[id] ?? BUILTIN.standard;
}

/** The Google font a template prints with, if any. */
export function invoiceWebFont(template: InvoiceTemplateOption | undefined): string | undefined {
  return designOf(template).skin.webFont;
}

/** A complete invoice in the chosen template. */
export function InvoiceDocument({
  template,
  data,
}: {
  template: InvoiceTemplateOption | undefined;
  data: InvoiceData;
}) {
  const { skin, header, footer, frame } = designOf(template);
  const foot = footer?.(data);
  return (
    <div
      data-invoice-doc
      style={{
        boxSizing: "border-box",
        width: "100%",
        background: "#ffffff",
        color: skin.ink,
        fontFamily: skin.font,
        fontSize: 12,
        lineHeight: 1.35,
        padding: frame ? 16 : 0,
        border: frame,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {header(data)}
      <InvoiceBody d={data} skin={skin} />
      {foot && <div style={{ marginTop: 6, breakInside: "avoid" }}>{foot}</div>}
    </div>
  );
}
