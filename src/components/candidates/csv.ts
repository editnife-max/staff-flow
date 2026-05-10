import type { Candidate, ColumnKey } from "./types";
import { COLUMNS } from "./types";

function escape(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv(rows: Candidate[], visible: ColumnKey[]) {
  const cols = COLUMNS.filter((c) => visible.includes(c.key));
  const header = cols.map((c) => escape(c.label)).join(",");
  const body = rows
    .map((r) =>
      cols
        .map((c) => {
          const v = (r as Record<string, unknown>)[c.key];
          if (c.type === "date" && v) return escape(new Date(String(v)).toISOString().slice(0, 10));
          return escape(v);
        })
        .join(","),
    )
    .join("\r\n");
  const csv = `${header}\r\n${body}`;
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `candidates_${today}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
