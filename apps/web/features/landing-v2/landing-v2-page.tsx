import { Footer } from "@/features/common/components/layout/footer";

import { V2CtaSection } from "./components/v2-cta-section";
import { V2DemoVideoSection } from "./components/v2-demo-video-section";
import { V2FeaturesSection } from "./components/v2-features-section";
import { V2Hero } from "./components/v2-hero";
import { V2HowItWorksSection } from "./components/v2-how-it-works-section";
import { V2Navbar } from "./components/v2-navbar";
import { V2ProblemsSection } from "./components/v2-problems-section";
import { V2TargetMarketSection } from "./components/v2-target-market-section";
import { V2UniqueSection } from "./components/v2-unique-section";

/** Renders the redesigned Highrable marketing landing page (v2). */
export function LandingPageV2() {
  return (
    <div className="bg-background font-sans text-foreground antialiased">
      <V2Navbar />
      <main>
        <V2Hero />
        <V2DemoVideoSection />
        <V2ProblemsSection />
        <V2FeaturesSection />
        <V2HowItWorksSection />
        <V2TargetMarketSection />
        <V2UniqueSection />
        <V2CtaSection />
      </main>
      <Footer />
    </div>
  );
}
