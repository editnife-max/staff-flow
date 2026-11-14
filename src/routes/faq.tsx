import { createFileRoute } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-shell";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Staff-Flow Agency" },
      { name: "description", content: "Frequently asked questions about Staff-Flow Agency." },
      { property: "og:title", content: "Staff-Flow FAQ" },
    ],
  }),
  component: FaqPage,
});

const faqs = [
  { q: "What is Staff-Flow?", a: "A platform that organizes the labor recruitment lifecycle from offering countries to employers." },
  { q: "Who can use it?", a: "Recruitment agencies, their staff, foreign agency partners, and platform admins." },
  { q: "How are candidates managed?", a: "Through a Kanban-style pipeline: Available → Processing → Arrived (or Canceled)." },
  { q: "Is my data secure?", a: "Yes. All data is protected with row-level security and encrypted in transit." },
];

function FaqPage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-20">
        <h1 className="mb-6 text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-5xl">FAQ</h1>
        <Accordion type="single" collapsible className="w-full rounded-2xl border bg-card px-5 shadow-xs">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="last:border-b-0">
              <AccordionTrigger className="text-left text-[15px]">{f.q}</AccordionTrigger>
              <AccordionContent className="text-[15px] leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </PublicShell>
  );
}
