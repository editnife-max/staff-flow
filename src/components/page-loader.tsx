import { Loader2 } from "lucide-react";

/** Full-screen placeholder while the session and role are being resolved. */
export function PageLoader() {
  return (
    <div
      className="grid min-h-[100dvh] place-items-center bg-background"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        Loading…
      </div>
    </div>
  );
}
