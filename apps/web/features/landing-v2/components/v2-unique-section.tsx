import {
  EDITORIAL_CONTAINER_CLASS,
  EDITORIAL_SECTION_CLASS,
  EditorialSectionLabel,
} from "./editorial-layout";
import { V2Reveal } from "./v2-animated-elements";

const REASONS = [
  {
    number: "01",
    title: "Trust is built into the system",
    description:
      "Payment is locked before work begins; reviews are tied to real completed jobs and can’t be faked or deleted.",
  },
  {
    number: "02",
    title: "Low-fee, global payments",
    description:
      "Get paid quickly across borders, without the delays and fees of a traditional bank transfer.",
  },
  {
    number: "03",
    title: "A reputation you own",
    description: "Your verified work history follows you — even if you move to another platform.",
  },
] as const;

/** Three clear reasons to choose Highrable, shown in the minimal 1C style. */
export function V2UniqueSection() {
  return (
    <section id="why-highrable" className={EDITORIAL_SECTION_CLASS}>
      <div className={`${EDITORIAL_CONTAINER_CLASS} max-w-4xl`}>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <EditorialSectionLabel>Why Highrable</EditorialSectionLabel>
          <V2Reveal
            as="h2"
            delay={0.08}
            className="hr-text-primary text-3xl leading-[1.08] font-bold tracking-tight sm:text-4xl md:text-5xl"
          >
            Not just another freelance platform.
          </V2Reveal>
          <V2Reveal
            as="p"
            delay={0.16}
            className="hr-text-secondary mx-auto mt-4 max-w-xl text-sm leading-relaxed sm:text-base"
          >
            Secure payments, global payouts, and a lasting work record in one place.
          </V2Reveal>
        </div>

        <div className="border-t border-border">
          {REASONS.map((reason, index) => (
            <V2Reveal
              as="article"
              key={reason.number}
              x={-16}
              y={12}
              delay={0.24 + index * 0.1}
              className="grid gap-3 border-b border-border py-6 sm:grid-cols-[56px_1fr] sm:gap-6 sm:py-7"
            >
              <span className="font-mono text-2xl font-semibold text-highrable-text-muted sm:text-3xl">
                {reason.number}
              </span>
              <div>
                <h3 className="hr-text-primary text-lg font-semibold sm:text-xl">{reason.title}</h3>
                <p className="hr-text-secondary mt-2 max-w-2xl text-sm leading-relaxed sm:text-base">
                  {reason.description}
                </p>
              </div>
            </V2Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
