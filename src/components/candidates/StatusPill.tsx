import { cn } from "@/lib/utils";

const PALETTE: Record<string, string> = {
  // availability
  available: "bg-success/15 text-success border-success/30",
  processing: "bg-warning/20 text-foreground border-warning/40",
  arrived: "bg-info/15 text-info border-info/30",
  canceled: "bg-destructive/15 text-destructive border-destructive/30",
  // medical
  fit: "bg-success/15 text-success border-success/30",
  unfit: "bg-destructive/15 text-destructive border-destructive/30",
  pending: "bg-muted text-muted-foreground border-border",
  // doc
  in_progress: "bg-warning/20 text-foreground border-warning/40",
  done: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  // passport
  submitted: "bg-warning/20 text-foreground border-warning/40",
  received: "bg-success/15 text-success border-success/30",
  expired: "bg-destructive/15 text-destructive border-destructive/30",
};

export function StatusPill({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  const style = PALETTE[value] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide whitespace-nowrap",
        style,
        className,
      )}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}
