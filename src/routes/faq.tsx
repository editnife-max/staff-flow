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
      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight text-accent mb-6">FAQ</h1>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent>{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </PublicShell>
  );
}
