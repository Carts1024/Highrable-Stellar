import { Footer } from "@/features/common/components/layout/footer";

import { Hero } from "./components/hero";
import { HowItWorksSection } from "./components/how-it-works-section";

/** Renders the marketing landing page for the Highrable platform. */
export function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorksSection />
      <Footer />
    </>
  );
}
