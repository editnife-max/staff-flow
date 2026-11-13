import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { DarkModeToggle } from "@/components/dark-mode-toggle";

const LINKS = [
  { to: "/about", label: "About" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
] as const;

const iconBtn =
  "inline-grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground";

/** Frame for the public info pages (About, FAQ, Contact). */
export function PublicShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const cta = user ? { to: "/dashboard", label: "Dashboard" } : { to: "/login", label: "Sign in" };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="glass-bar sticky top-0 z-40 border-b border-border/70 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-primary text-primary-foreground shadow-sm">
              <Building2 className="h-4 w-4" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Staff-Flow</span>
          </Link>

          <nav aria-label="Main" className="ml-6 hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-full px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground bg-foreground/[0.06]" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <DarkModeToggle className={iconBtn} />
            <Link
              to={cta.to}
              className="hidden h-8 items-center gap-1 rounded-full bg-primary px-4 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:inline-flex"
            >
              {cta.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              className={cn(iconBtn, "md:hidden")}
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-border/70 px-4 pb-4 pt-2 md:hidden">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="flex h-11 items-center rounded-xl px-3 text-[15px] font-medium text-foreground/80 hover:bg-foreground/[0.05]"
                activeProps={{ className: "text-primary" }}
              >
                {l.label}
              </Link>
            ))}
            <Link
              to={cta.to}
              onClick={() => setOpen(false)}
              className="mt-2 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary text-[15px] font-medium text-primary-foreground"
            >
              {cta.label} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:px-6">
          <div>© {new Date().getFullYear()} Staff-Flow Agency</div>
          <div className="flex items-center gap-4">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
