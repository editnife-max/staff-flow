import { createFileRoute } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-shell";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Staff-Flow Agency" },
      { name: "description", content: "About Staff-Flow Agency: integrating and organizing the labor recruitment process end-to-end." },
      { property: "og:title", content: "About Staff-Flow Agency" },
      { property: "og:description", content: "Comprehensive recruitment for offering countries and employers." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <PublicShell>
      <div className="container mx-auto px-6 py-16 max-w-4xl">
        <h1 className="text-4xl font-semibold tracking-tight text-accent mb-6">About Staff-Flow</h1>
        <p className="text-lg leading-relaxed text-foreground/80">
          Staff-Flow is an electronic platform that aims to provide a comprehensive system to
          integrate and organize the labor recruitment process from offering countries,
          digitally authenticating the contract between the employer and the laborer and organizing
          the contractual relationship between recruitment offices and external recruitment offices.
        </p>
        <p className="text-lg leading-relaxed text-foreground/80 mt-4">
          We facilitate the labor recruitment process and protect the legal rights of the binding
          parties by applying a comprehensive process that starts with the recruitment and selection
          of a suitable candidate by the employer and ends with the candidate's arrival, all
          documented and authenticated through signed contracts of all involved parties.
        </p>
      </div>
    </PublicShell>
  );
}
