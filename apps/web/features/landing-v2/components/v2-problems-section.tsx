import {
  EDITORIAL_CONTAINER_CLASS,
  EDITORIAL_SECTION_CLASS,
  EditorialSectionLabel,
} from "./editorial-layout";
import { V2Reveal } from "./v2-animated-elements";

const PROBLEMS = [
  {
    number: "01",
    title: "Trust & reliability",
    description: "Freelancers risk unpaid work; clients face missed deadlines and scope changes.",
  },
  {
    number: "02",
    title: "High & hidden fees",
    description:
      "Commissions and opaque conversion fees quietly reduce what freelancers take home.",
  },
  {
    number: "03",
    title: "Slow, limited payments",
    description:
      "Payout delays and expensive cross-border transfers block freelancers from their own income.",
  },
] as const;

/** Minimal editorial summary of common freelance marketplace problems. */
export function V2ProblemsSection() {
  return (
    <section className={`${EDITORIAL_SECTION_CLASS} text-center`}>
      <div className={`${EDITORIAL_CONTAINER_CLASS} max-w-3xl`}>
        <div className="mb-8">
          <EditorialSectionLabel>The problem today</EditorialSectionLabel>
          <V2Reveal
            as="h2"
            delay={0.08}
            className="hr-text-primary text-3xl leading-[1.08] font-bold tracking-tight sm:text-4xl md:text-5xl"
          >
            Freelance work should feel fair on both sides.
          </V2Reveal>
          <V2Reveal
            as="p"
            delay={0.16}
            className="hr-text-secondary mx-auto mt-4 max-w-xl text-sm leading-relaxed sm:text-base"
          >
            Payment, project scope, and timing should be clear before work begins.
          </V2Reveal>
        </div>

        <div className="border-t border-border text-left">
          {PROBLEMS.map((problem, index) => (
            <V2Reveal
              as="article"
              key={problem.number}
              x={-16}
              y={12}
              delay={0.24 + index * 0.1}
              className="grid gap-3 border-b border-border py-6 sm:grid-cols-[56px_1fr] sm:gap-6 sm:py-7"
            >
              <span className="font-mono text-2xl font-bold text-highrable-text-muted">
                {problem.number}
              </span>
              <div>
                <h3 className="hr-text-primary text-base font-semibold sm:text-lg">
                  {problem.title}
                </h3>
                <p className="hr-text-secondary mt-2 max-w-2xl text-sm leading-relaxed">
                  {problem.description}
                </p>
              </div>
            </V2Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
