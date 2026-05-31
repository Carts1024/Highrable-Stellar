export type TNavLink = {
  readonly label: string;
  readonly href: string;
};

export type TProblemItem = {
  readonly id: string;
  readonly number: string;
  readonly title: string;
  readonly description: string;
  readonly stat: string;
  readonly statSource: string;
};

export type TFeatureItem = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly businessValue: string;
  readonly comingSoon?: boolean;
};

export type TWorkflowStep = {
  readonly step: number;
  readonly title: string;
  readonly description: string;
  readonly comingSoon?: boolean;
};

export type TPricingFeature = {
  readonly label: string;
  readonly included: boolean;
  readonly comingSoon?: boolean;
};

export type TPricingTier = {
  readonly id: string;
  readonly name: string;
  readonly price: string;
  readonly period: string;
  readonly description: string;
  readonly features: readonly TPricingFeature[];
  readonly highlighted: boolean;
  readonly ctaLabel: string;
};

export type TPricingCategory = {
  readonly label: string;
  readonly tiers: readonly TPricingTier[];
};

export type TUniquePoint = {
  readonly id: string;
  readonly number: string;
  readonly title: string;
  readonly points: readonly string[];
  readonly comingSoon?: boolean;
};

export type TTargetSegment = {
  readonly id: string;
  readonly role: "Freelancer" | "Client";
  readonly title: string;
  readonly description: string;
  readonly needs: readonly string[];
};
