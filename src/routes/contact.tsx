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
      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight text-accent mb-6">Contact us</h1>
        <p className="text-muted-foreground mb-10">We usually respond within one business day.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <a href="tel:920002866" className="flex items-center gap-3 rounded-xl border bg-card p-5 hover:border-accent">
            <Phone className="h-5 w-5 text-accent" />
            <div>
              <div className="text-xs text-muted-foreground">Phone</div>
              <div className="font-medium">920 002 866</div>
            </div>
          </a>
          <a href="mailto:hello@staff-flow.app" className="flex items-center gap-3 rounded-xl border bg-card p-5 hover:border-accent">
            <Mail className="h-5 w-5 text-accent" />
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
