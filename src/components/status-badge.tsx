import { cn } from "@/lib/utils";

export type Status = "available" | "processing" | "arrived" | "canceled";

const styles: Record<Status, string> = {
  available: "bg-success/15 text-success border-success/30",
  processing: "bg-warning/20 text-foreground border-warning/40",
  arrived: "bg-info/15 text-info border-info/30",
  canceled: "bg-destructive/15 text-destructive border-destructive/30",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const key = (status in styles ? status : "available") as Status;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide",
        styles[key],
        className,
      )}
    >
      {status}
    </span>
  );
}
