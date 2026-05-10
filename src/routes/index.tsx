import { Link, createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Staff-Flow Agency — Comprehensive Recruitment Journey" },
      {
        name: "description",
        content:
          "An electronic platform integrating and organizing the labor recruitment process from offering countries to employers.",
      },
    ],
  }),
  component: Index,
});

function PublicHeader() {
  const { user } = useAuth();
  return (
    <header className="absolute inset-x-0 top-0 z-10">
      <div className="container mx-auto flex items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 text-primary-foreground">
          <div className="h-9 w-9 rounded-lg bg-accent grid place-items-center">
            <Building2 className="h-5 w-5 text-accent-foreground" />
          </div>
          <span className="font-semibold tracking-tight">Staff-Flow</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-primary-foreground/90">
          <Link to="/about" className="hover:text-primary-foreground">About</Link>
          <Link to="/faq" className="hover:text-primary-foreground">FAQ</Link>
          <Link to="/contact" className="hover:text-primary-foreground">Contact</Link>
          <span className="text-primary-foreground/40">|</span>
          {user ? (
            <Link to="/dashboard" className="font-medium hover:text-accent">Dashboard</Link>
          ) : (
            <Link to="/login" className="font-medium hover:text-accent">Login</Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function Index() {
  const { user } = useAuth();
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-primary" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_oklch(0.74_0.09_200/0.35),_transparent_45%),radial-gradient(circle_at_75%_70%,_oklch(0.5_0.18_280/0.3),_transparent_50%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/20 to-primary/80" />

      <PublicHeader />

      <div className="relative container mx-auto px-6 pt-40 pb-32 text-primary-foreground">
        <h1 className="text-5xl md:text-6xl font-light leading-tight max-w-3xl">
          Staff-Flow..
          <br />
          <span className="font-semibold">Comprehensive</span>
          <br />
          <span className="font-semibold">Recruitment journey</span>
        </h1>
        <p className="mt-6 max-w-xl text-primary-foreground/80 text-lg">
          Integrate and organize the entire labor recruitment process — from offering
          countries to employers — on one digital platform.
        </p>
        <div className="mt-10">
          <Button asChild size="lg" variant="outline" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground bg-transparent h-12 px-8">
            <Link to={user ? "/dashboard" : "/login"}>
              {user ? "Go to dashboard" : "Get started"}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
