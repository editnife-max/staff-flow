import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight, Users2, FileCheck, Activity,
  CheckCircle2, Globe, Building2, Menu, X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Staff-Flow — End-to-End Recruitment Management" },
      {
        name: "description",
        content:
          "Staff-Flow digitizes and organizes the complete labor recruitment process — from candidate selection to arrival — on one secure platform.",
      },
      { property: "og:title", content: "Staff-Flow — Recruitment Management Platform" },
      { property: "og:description", content: "End-to-end recruitment for agencies and employers." },
    ],
  }),
  component: LandingPage,
});

// ─── Nav ─────────────────────────────────────────────────────────────────────
function Nav({ transparent }: { transparent: boolean }) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        transparent
          ? "bg-transparent"
          : "bg-[oklch(0.13_0.04_144)]/95 backdrop-blur-sm border-b border-white/5",
      )}
    >
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 text-white">
          <div className="h-8 w-8 rounded-lg bg-primary grid place-items-center shrink-0">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold tracking-tight">Staff-Flow</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7 text-sm text-white/70">
          <Link to="/about" className="hover:text-white transition-colors">About</Link>
          <Link to="/faq"   className="hover:text-white transition-colors">FAQ</Link>
          <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            to={user ? "/dashboard" : "/login"}
            className="text-sm text-white/80 hover:text-white transition-colors"
          >
            {user ? "Dashboard" : "Sign in"}
          </Link>
          {!user && (
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-white">
              <Link to="/login">Get started <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden text-white/80 hover:text-white"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-[oklch(0.13_0.04_144)] border-t border-white/10 px-6 pb-5 pt-3 space-y-3">
          {[
            { label: "About", to: "/about" },
            { label: "FAQ", to: "/faq" },
            { label: "Contact", to: "/contact" },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to as any}
              className="block text-sm text-white/70 hover:text-white py-1"
              onClick={() => setMobileOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-white/10">
            <Button asChild className="w-full bg-primary hover:bg-primary/90 text-white">
              <Link to={user ? "/dashboard" : "/login"} onClick={() => setMobileOpen(false)}>
                {user ? "Go to dashboard" : "Get started"}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  const { user } = useAuth();

  return (
    <section
      className="relative min-h-screen flex flex-col justify-center overflow-hidden"
      style={{ background: "oklch(0.13 0.04 144)" }}
    >
      {/* Subtle grid */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      {/* Radial glow */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, oklch(0.52 0.13 144 / 0.25), transparent 70%)",
        }}
      />
      {/* Bottom fade */}
      <div
        aria-hidden
        className="absolute bottom-0 inset-x-0 h-40 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, oklch(0.97 0.007 81))" }}
      />

      <div className="relative container mx-auto px-6 pt-32 pb-28 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70 mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Recruitment Management Platform
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-white leading-[1.08] tracking-tight max-w-4xl mx-auto">
          Organize your entire{" "}
          <span
            className="inline-block"
            style={{
              background: "linear-gradient(135deg, oklch(0.72 0.16 144), oklch(0.56 0.14 164))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            recruitment
          </span>{" "}
          journey.
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
          From candidate selection to visa, ticket, and arrival — Staff-Flow brings
          every step of the labor recruitment process onto one secure digital platform.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            asChild
            size="lg"
            className="h-12 px-8 text-base bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
          >
            <Link to={user ? "/dashboard" : "/login"}>
              {user ? "Go to dashboard" : "Start for free"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="h-12 px-8 text-base text-white/70 hover:text-white hover:bg-white/5"
          >
            <Link to="/about">Learn how it works</Link>
          </Button>
        </div>

        {/* Stat pills */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-3">
          {[
            { value: "100%", label: "Digital workflow" },
            { value: "End-to-end", label: "Candidate tracking" },
            { value: "Real-time", label: "Staff monitoring" },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-white/80"
            >
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold text-white">{s.value}</span>
              <span className="text-white/50">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Users2,
    color: "bg-primary/10 text-primary",
    title: "Candidate Pipeline",
    description:
      "Register candidates, assign them to staff, and track every step — visa status, ticket booking, and arrival city — from a single dashboard.",
  },
  {
    icon: Activity,
    color: "bg-blue-500/10 text-blue-600",
    title: "Staff Productivity",
    description:
      "Monitor real-time logins, work hours, and candidate activity for every team member. Attendance is tracked automatically — no manual reporting.",
  },
  {
    icon: FileCheck,
    color: "bg-violet-500/10 text-violet-600",
    title: "Document Control",
    description:
      "Generate professional CVs, track visa and ticket updates, and manage agency contracts — all digitally signed and instantly accessible.",
  },
  {
    icon: Globe,
    color: "bg-amber-500/10 text-amber-600",
    title: "Agency Network",
    description:
      "Connect with foreign agencies, assign candidates across offices, and maintain a clear chain of responsibility throughout the recruitment lifecycle.",
  },
];

function Features() {
  return (
    <section className="bg-background py-24">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
            Platform capabilities
          </p>
          <h2 className="text-4xl font-bold tracking-tight text-foreground">
            Everything your agency needs,{" "}
            <span className="text-muted-foreground font-normal">in one place.</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-card p-6 hover:border-primary/30 hover:shadow-md transition-all duration-200"
            >
              <div className={cn("h-10 w-10 rounded-xl grid place-items-center mb-5", f.color)}>
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────
const STEPS = [
  {
    num: "01",
    title: "Register candidates",
    description:
      "Managers create candidate profiles and assign them to staff for processing. Every detail is captured — from interview to contract.",
  },
  {
    num: "02",
    title: "Track processing",
    description:
      "Follow visa applications, ticket bookings, and arrival logistics in real time. Status updates are instant and visible to everyone on the team.",
  },
  {
    num: "03",
    title: "Monitor your team",
    description:
      "Automatic attendance tracking records who's online, how long they work, and how many candidates they process — every day.",
  },
];

function HowItWorks() {
  return (
    <section className="bg-muted/40 py-24">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-xl mx-auto mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
            Simple by design
          </p>
          <h2 className="text-4xl font-bold tracking-tight text-foreground">
            How Staff-Flow works
          </h2>
          <p className="mt-4 text-muted-foreground">
            Three steps from onboarding to delivery. No training required.
          </p>
        </div>

        <div className="relative grid md:grid-cols-3 gap-8">
          {/* Connector line (desktop only) */}
          <div
            aria-hidden
            className="hidden md:block absolute top-8 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px"
            style={{ background: "linear-gradient(90deg, transparent, oklch(0.52 0.13 144 / 0.3) 20%, oklch(0.52 0.13 144 / 0.3) 80%, transparent)" }}
          />

          {STEPS.map((s) => (
            <div key={s.num} className="relative text-center md:text-left">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-primary/20 bg-background text-2xl font-bold text-primary mb-5">
                {s.num}
              </div>
              <h3 className="font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA Band ─────────────────────────────────────────────────────────────────
function CtaBand() {
  const { user } = useAuth();
  return (
    <section
      className="relative py-24 overflow-hidden"
      style={{ background: "oklch(0.13 0.04 144)" }}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 80% at 50% 100%, oklch(0.52 0.13 144 / 0.2), transparent 70%)",
        }}
      />
      <div className="relative container mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight max-w-2xl mx-auto leading-tight">
          Ready to streamline your agency?
        </h2>
        <p className="mt-4 text-white/60 max-w-lg mx-auto">
          Join agencies already managing their full recruitment lifecycle on Staff-Flow.
        </p>
        <div className="mt-10">
          <Button
            asChild
            size="lg"
            className="h-12 px-10 text-base bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20"
          >
            <Link to={user ? "/dashboard" : "/login"}>
              {user ? "Go to dashboard" : "Get started free"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-white/30">No credit card required.</p>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-background border-t border-border">
      <div className="container mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-primary grid place-items-center">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-foreground">Staff-Flow</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Comprehensive recruitment management for modern labor agencies.
            </p>
          </div>

          <div className="flex flex-wrap gap-12 text-sm">
            <div className="space-y-3">
              <p className="font-semibold text-foreground text-xs uppercase tracking-widest">Platform</p>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link to="/login" className="hover:text-foreground transition-colors">Sign in</Link></li>
                <li><Link to="/faq" className="hover:text-foreground transition-colors">FAQ</Link></li>
              </ul>
            </div>
            <div className="space-y-3">
              <p className="font-semibold text-foreground text-xs uppercase tracking-widest">Company</p>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link to="/about" className="hover:text-foreground transition-colors">About</Link></li>
                <li><Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Staff-Flow. All rights reserved.</p>
          <p>Built for recruitment agencies worldwide.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function LandingPage() {
  return (
    <div className="min-h-screen">
      <Nav transparent />
      <Hero />
      <Features />
      <HowItWorks />
      <CtaBand />
      <Footer />
    </div>
  );
}
