import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone } from "lucide-react";
import { PublicShell } from "@/components/public-shell";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Staff-Flow Agency" },
      { name: "description", content: "Get in touch with Staff-Flow Agency." },
      { property: "og:title", content: "Contact Staff-Flow Agency" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-20">
        <h1 className="mb-6 text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-5xl">Contact us</h1>
        <p className="text-muted-foreground mb-10">We usually respond within one business day.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <a href="tel:920002866" className="flex items-center gap-3 rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary/50">
            <Phone className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Phone</div>
              <div className="font-medium">920 002 866</div>
            </div>
          </a>
          <a href="mailto:hello@staff-flow.app" className="flex items-center gap-3 rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary/50">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Email</div>
              <div className="font-medium">hello@staff-flow.app</div>
            </div>
          </a>
        </div>
      </div>
    </PublicShell>
  );
}
