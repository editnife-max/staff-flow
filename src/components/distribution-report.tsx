import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Star,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DistributionJob, DistributionReport } from "@/hooks/use-distribution";

// ── Star rating ───────────────────────────────────────────────────────────────

export function StarRating({
  value,
  onChange,
  size = "sm",
  disabled,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  const px = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHover(null)}
      role={onChange ? "radiogroup" : undefined}
      aria-label={`Rating ${value} of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange || disabled}
          role={onChange ? "radio" : undefined}
          aria-checked={onChange ? value === n : undefined}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onMouseEnter={() => onChange && setHover(n)}
          onClick={() => onChange?.(n)}
          className={cn(
            "p-0.5 -m-0.5",
            onChange && !disabled ? "cursor-pointer" : "cursor-default",
          )}
        >
          <Star
            className={cn(
              px,
              n <= shown ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
            )}
          />
        </button>
      ))}
    </div>
  );
}

// ── Report ────────────────────────────────────────────────────────────────────

const KIND_LABEL: Record<DistributionJob["kind"], string> = {
  distribute: "Distribution",
  expiry: "Expired CVs moved",
  office_locked: "Locked office",
  manual_send: "Manual send",
};

export function JobStatusLine({ job }: { job: DistributionJob | null | undefined }) {
  if (!job) return null;
  if (job.status === "pending" || job.status === "running") {
    return (
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {job.status === "pending"
          ? "Queued — starting in the background…"
          : "Running in the background…"}
      </div>
    );
  }
  if (job.status === "failed") {
    return (
      <div className="flex items-center gap-2 text-[12px] text-destructive">
        <XCircle className="h-3.5 w-3.5" /> {KIND_LABEL[job.kind]} failed:{" "}
        {job.error ?? "unknown error"}
      </div>
    );
  }
  if (job.status === "cancelled") {
    return (
      <div className="text-[12px] text-muted-foreground">
        {KIND_LABEL[job.kind]} cancelled{job.result?.note ? ` — ${job.result.note}` : ""}
      </div>
    );
  }
  return null;
}

function Section({
  title,
  count,
  tone,
  children,
  defaultOpen = false,
}: {
  title: string;
  count: number;
  tone: "warn" | "info" | "bad";
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!count) return null;
  return (
    <div className="border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium hover:bg-muted/40 text-left"
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            tone === "warn" ? "bg-amber-500" : tone === "bad" ? "bg-destructive" : "bg-primary",
          )}
        />
        <span className="flex-1">{title}</span>
        <span className="tabular-nums text-muted-foreground">{count}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="border-t border-border max-h-44 overflow-y-auto divide-y divide-border/60">
          {children}
        </div>
      )}
    </div>
  );
}

const Row = ({ name, detail }: { name: string; detail?: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 px-3 py-1 text-[12px]">
    <span className="truncate">{name}</span>
    {detail && (
      <span className="text-muted-foreground text-right shrink-0 max-w-[60%]">{detail}</span>
    )}
  </div>
);

export function DistributionReportView({
  report,
  kind,
}: {
  report: DistributionReport;
  kind?: DistributionJob["kind"];
}) {
  const s = report.skipped;
  const t = report.totals ?? {};
  const more = (shown: number, total: number | undefined) =>
    total && total > shown ? (
      <div className="px-3 py-1 text-[11px] text-muted-foreground">…and {total - shown} more</div>
    ) : null;
  const offices = Object.entries(report.byOffice).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-[12px] text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="font-semibold">
          {report.assigned} CV{report.assigned === 1 ? "" : "s"} sent
        </span>
        {kind && (
          <span className="text-emerald-700/70 dark:text-emerald-400/70">· {KIND_LABEL[kind]}</span>
        )}
        {report.officeName && <span className="truncate">· {report.officeName}</span>}
      </div>
      {report.note && <p className="text-[12px] text-muted-foreground px-1">{report.note}</p>}

      {offices.length > 0 && (
        <div className="border border-border divide-y divide-border/60">
          {offices.map(([name, n]) => (
            <Row
              key={name}
              name={name}
              detail={<span className="tabular-nums font-medium text-foreground">+{n}</span>}
            />
          ))}
        </div>
      )}

      <Section title="Moved to another office" count={t.moved ?? report.moved.length} tone="info">
        {report.moved.map((m) => (
          <Row
            key={m.id}
            name={m.name}
            detail={
              <span className="inline-flex items-center gap-1">
                {m.from} <ArrowRight className="h-3 w-3" /> {m.to}
              </span>
            }
          />
        ))}
        {more(report.moved.length, t.moved)}
      </Section>

      <Section
        title="No country entered — add a country first"
        count={t.no_country ?? s.no_country.length}
        tone="warn"
        defaultOpen
      >
        {s.no_country.map((c) => (
          <Row key={c.id} name={c.name} />
        ))}
        {more(s.no_country.length, t.no_country)}
      </Section>

      <Section
        title="Country has no unlocked office"
        count={t.no_office_for_country ?? s.no_office_for_country.length}
        tone="warn"
        defaultOpen
      >
        {s.no_office_for_country.map((c) => (
          <Row key={c.id} name={c.name} detail={c.country} />
        ))}
        {more(s.no_office_for_country.length, t.no_office_for_country)}
      </Section>

      <Section title="Not CV ready" count={t.not_ready ?? s.not_ready.length} tone="info">
        {s.not_ready.map((c) => (
          <Row key={c.id} name={c.name} detail={c.problems.join(", ")} />
        ))}
        {more(s.not_ready.length, t.not_ready)}
      </Section>

      <Section
        title="Every office in the country already had the CV — kept for a new round"
        count={t.no_other_office ?? s.no_other_office.length}
        tone="warn"
      >
        {s.no_other_office.map((c) => (
          <Row key={c.id} name={c.name} detail={c.office ? `at ${c.office}` : undefined} />
        ))}
        {more(s.no_other_office.length, t.no_other_office)}
      </Section>

      <Section
        title="Processing kept with the locked office (visa issued / ticket booked)"
        count={t.kept_processing ?? s.kept_processing.length}
        tone="warn"
        defaultOpen
      >
        {s.kept_processing.map((c) => (
          <Row key={c.id} name={c.name} detail={c.reason} />
        ))}
        {more(s.kept_processing.length, t.kept_processing)}
      </Section>

      <Section title="Not sent" count={t.rejected ?? s.rejected.length} tone="bad" defaultOpen>
        {s.rejected.map((c) => (
          <Row key={c.id} name={c.name} detail={c.reason} />
        ))}
        {more(s.rejected.length, t.rejected)}
      </Section>

      {(t.processing_returned ?? 0) > 0 && (
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground px-1">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          {t.processing_returned} processing candidate{t.processing_returned === 1 ? "" : "s"}{" "}
          returned to Available (employer work reset).
        </p>
      )}
    </div>
  );
}
