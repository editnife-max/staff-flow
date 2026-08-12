import { Link } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { DarkModeToggle } from "@/components/dark-mode-toggle";

export function PublicShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-accent grid place-items-center">
              <Building2 className="h-5 w-5 text-accent-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Staff-Flow</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <DarkModeToggle className="h-8 w-8 text-primary-foreground hover:text-primary-foreground hover:bg-primary/80" />
            <Link to="/about" className="hover:text-accent">About</Link>
            <Link to="/faq" className="hover:text-accent">FAQ</Link>
            <Link to="/contact" className="hover:text-accent">Contact</Link>
            <span className="text-primary-foreground/40">|</span>
            {user ? (
              <Link to="/dashboard" className="font-medium hover:text-accent">Dashboard</Link>
            ) : (
              <Link to="/login" className="font-medium hover:text-accent">Login</Link>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-muted/40">
        <div className="container mx-auto px-6 py-6 text-sm text-muted-foreground flex flex-wrap items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} Staff-Flow Agency</div>
          <div>Built for modern recruitment teams</div>
        </div>
      </footer>
    </div>
  );
}
