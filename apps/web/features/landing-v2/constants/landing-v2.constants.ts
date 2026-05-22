import type {
  TFeatureItem,
  TNavLink,
  TPricingCategory,
  TProblemItem,
  TTargetSegment,
  TUniquePoint,
  TWorkflowStep,
} from "../types/landing-v2.types";

export const NAV_LINKS: readonly TNavLink[] = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Why Highrable", href: "#why-highrable" },
];

export const PROBLEMS: readonly TProblemItem[] = [
  {
    id: "trust",
    number: "01",
    title: "Trust & Reliability",
    description:
      "Freelancers risk unpaid work while clients face missed deadlines, fake reviews, and scope changes - making every collaboration inherently risky.",
    stat: "65%",
    statSource:
      "of freelancers experienced an invoice dispute last year (The Freelance Informer, 2023)",
  },
  {
    id: "fees",
    number: "02",
    title: "High & Hidden Fees",
    description:
      "Platform commissions of 10-20% and opaque currency conversion fees directly reduce freelancers' take-home pay on every single project.",
    stat: "20%",
    statSource: "Fiverr's flat commission; Upwork charges up to 15% plus withdrawal fees",
  },
  {
    id: "payments",
    number: "03",
    title: "Slow & Limited Payments",
    description:
      "Payout delays of 2-7 days, restricted withdrawal methods, and expensive cross-border transfers block freelancers from accessing their own income.",
    stat: "6.49%",
    statSource: "average global remittance cost - over 2x the UN SDG 3% target (World Bank, 2025)",
  },
  {
    id: "geographic",
    number: "04",
    title: "Geographic Inequality",
    description:
      "Freelancers in developing markets are underpaid and sidelined by currency barriers and geographic bias built into dominant platform structures.",
    stat: "65%",
    statSource:
      "of global freelancers lost earnings due to incompatible currencies (Rosales, 2024)",
  },
  {
    id: "hiring",
    number: "05",
    title: "Inefficient Hiring",
    description:
      "Clients struggle to find reliable talent fast, with average time-to-hire at 20-44 days and 83% of managers citing missed hires from slow processes.",
    stat: "44 days",
    statSource: "average time-to-hire across industries (Visier, 2025)",
  },
];

export const FEATURES: readonly TFeatureItem[] = [
  {
    id: "escrow",
    title: "Smart Contract Escrow",
    description:
      "Client funds are locked in a Stellar smart contract before work begins and released automatically upon milestone approval - zero manual mediation.",
    businessValue: "Eliminates payment risk and non-payment disputes entirely.",
  },
  {
    id: "reviews",
    title: "On-Chain Reviews",
    description:
      "Reviews are tied to verified transactions and stored on-chain - tamper-proof and permanently linked to real, completed work.",
    businessValue: "Reduces hiring risk and ensures platform credibility at every level.",
  },
  {
    id: "ai-matching",
    title: "AI Matching + Interview",
    description:
      "Coming soon: AI candidate recommendations, resume parsing, and automated skill assessments for faster shortlisting.",
    businessValue: "Planned to support faster, data-driven hiring with less manual screening.",
    comingSoon: true,
  },
  {
    id: "wallet",
    title: "Stablecoin Payments",
    description:
      "Instant cross-border payments via stablecoins on Stellar - low-cost, fast, and accessible from anywhere in the world.",
    businessValue: "Higher take-home pay and global participation for freelancers.",
  },
  {
    id: "reputation",
    title: "Portable Reputation",
    description:
      "Work history and ratings live on-chain and are owned by the user - not locked into a single platform's ecosystem.",
    businessValue: "Freelancers build long-term career credibility, not just platform scores.",
  },
  {
    id: "onboarding",
    title: "Simple Onboarding",
    description:
      "Sign up with email or social login via smart wallets. No private keys or seed phrases required to get started on Stellar.",
    businessValue: "Lowers entry barriers for both Web2 and Web3 users at scale.",
  },
];

export const FREELANCER_STEPS: readonly TWorkflowStep[] = [
  {
    step: 1,
    title: "Discover Opportunity",
    description:
      "Coming soon: AI-matched job recommendations tailored to your skills and expertise",
    comingSoon: true,
  },
  {
    step: 2,
    title: "Secure Agreement",
    description: "Submit proposal and sign a blockchain-backed smart contract",
  },
  {
    step: 3,
    title: "Start Work",
    description: "Begin with confidence - client funds are locked in escrow",
  },
  {
    step: 4,
    title: "Submit Deliverables",
    description: "Deliver completed work and mark your milestone complete",
  },
  {
    step: 5,
    title: "Instant Payout",
    description: "Client approval triggers automatic stablecoin payment to your wallet",
  },
  {
    step: 6,
    title: "Build Reputation",
    description:
      "Your verified on-chain review is permanently recorded for every future client to see",
  },
];

export const CLIENT_STEPS: readonly TWorkflowStep[] = [
  {
    step: 1,
    title: "Post a Job",
    description: "Define milestones, set rates, and fund the escrow smart contract",
  },
  {
    step: 2,
    title: "Review AI Matches",
    description: "Coming soon: AI-screened applicants ranked by fit, skill, and verified history",
    comingSoon: true,
  },
  {
    step: 3,
    title: "Run AI Interview",
    description: "Coming soon: automated skill assessments for shortlisted candidates",
    comingSoon: true,
  },
  {
    step: 4,
    title: "Monitor Progress",
    description: "Track milestones and communicate directly with your freelancer",
  },
  {
    step: 5,
    title: "Approve Work",
    description: "Review deliverables and trigger milestone-based payment release",
  },
  {
    step: 6,
    title: "Rate & Record",
    description: "On-chain review strengthens both parties' reputation on the network",
  },
];

export const PRICING_CATEGORIES: readonly TPricingCategory[] = [
  {
    label: "For Freelancers",
    tiers: [
      {
        id: "freelancer-basic",
        name: "Basic",
        price: "Free",
        period: "",
        description: "Get started with core marketplace access",
        features: [
          { label: "Standard profile", included: true },
          { label: "Limited monthly proposals", included: true },
          { label: "Access to all job listings", included: true },
          { label: "AI Resume Enhancements", included: false, comingSoon: true },
          { label: "Profile boosts", included: false },
          { label: "Priority support", included: false },
        ],
        highlighted: false,
        ctaLabel: "Start Free",
      },
      {
        id: "freelancer-pro",
        name: "Pro",
        price: "$5",
        period: "/month",
        description: "For active freelancers growing their client base",
        features: [
          { label: "Unlimited proposals", included: true },
          { label: "5 AI Resume Enhancements/month", included: false, comingSoon: true },
          { label: "2 profile boosts/month", included: true },
          { label: "Priority support", included: true },
          { label: "Advanced market analytics", included: false },
          { label: "Dedicated account manager", included: false },
        ],
        highlighted: true,
        ctaLabel: "Go Pro",
      },
      {
        id: "freelancer-premium",
        name: "Premium",
        price: "$15",
        period: "/month",
        description: "Maximum visibility and tools for top earners",
        features: [
          { label: "Unlimited proposals", included: true },
          { label: "10 AI Resume Enhancements/month", included: false, comingSoon: true },
          { label: "Unlimited profile boosts", included: true },
          { label: "Priority support", included: true },
          { label: "Advanced market analytics", included: true },
          { label: "Dedicated account manager", included: true },
        ],
        highlighted: false,
        ctaLabel: "Go Premium",
      },
    ],
  },
  {
    label: "For Clients",
    tiers: [
      {
        id: "client-basic",
        name: "Basic",
        price: "Free",
        period: "",
        description: "Post jobs now; AI-matched candidates are coming soon",
        features: [
          { label: "Up to 3 job posts/month", included: true },
          { label: "Standard AI matching", included: false, comingSoon: true },
          { label: "5% escrow fee applies", included: true },
          { label: "AI interview credits", included: false, comingSoon: true },
          { label: "Advanced candidate analytics", included: false },
          { label: "Job post boosting", included: false },
        ],
        highlighted: false,
        ctaLabel: "Start Free",
      },
      {
        id: "client-business",
        name: "Business",
        price: "$25",
        period: "/month",
        description: "Scale your team now; AI-powered hiring is coming soon",
        features: [
          { label: "Unlimited job posts", included: true },
          { label: "10 AI interview credits/month", included: false, comingSoon: true },
          { label: "2.5% escrow fee (50% off)", included: true },
          { label: "Advanced candidate analytics", included: true },
          { label: "Job post boosting", included: true },
          { label: "Priority support", included: true },
        ],
        highlighted: true,
        ctaLabel: "Get Business",
      },
    ],
  },
];

export const UNIQUE_POINTS: readonly TUniquePoint[] = [
  {
    id: "trust",
    number: "01",
    title: "Trust is Embedded in the System",
    points: [
      "Smart contract escrow locks funds before work begins",
      "Transaction-linked on-chain reviews cannot be faked or removed",
      "Milestone-based automated fund release - no manual platform mediation",
    ],
  },
  {
    id: "ai-blockchain",
    number: "02",
    title: "AI Hiring + Blockchain Verification",
    points: [
      "Coming soon: AI Matching and AI Interview for faster, smarter talent selection",
      "Blockchain escrow and on-chain reviews for verified execution",
      "Complete journey: match -> verify work -> release payment -> build reputation",
    ],
    comingSoon: true,
  },
  {
    id: "borderless",
    number: "03",
    title: "Borderless & Low-Fee Freelancing",
    points: [
      "Stablecoin payments with near-zero gas fees on Stellar",
      "Cross-border payouts without traditional banking delays or restrictions",
      "Flat 5% fee - versus the 10-20% industry standard on legacy platforms",
    ],
  },
  {
    id: "reputation",
    number: "04",
    title: "Reputation Owned by the User",
    points: [
      "Work history is tied to verified, immutable on-chain transactions",
      "Reviews are tamper-resistant and harder to manipulate or delete",
      "Portable reputation that follows the freelancer across platforms",
    ],
  },
  {
    id: "accessibility",
    number: "05",
    title: "Web3 Innovation + Mainstream Access",
    points: [
      "Sign up via email or social login - zero crypto knowledge required",
      "Fiat-to-stablecoin abstraction lets clients pay with a credit card",
      "Competes with both Web2 platforms and Web3 marketplaces simultaneously",
    ],
  },
];

export const TARGET_SEGMENTS: readonly TTargetSegment[] = [
  {
    id: "traditional-freelancer",
    role: "Freelancer",
    title: "The Hustling Freelancer",
    description:
      "Designers, developers, and writers who are done losing income to hidden fees, payout delays, and platform non-payment risks.",
    needs: [
      "Instant borderless payouts",
      "Zero commissions on earnings",
      "Equal opportunity regardless of location",
      "Portable on-chain reputation",
    ],
  },
  {
    id: "web3-freelancer",
    role: "Freelancer",
    title: "The Web3-Savvy Freelancer",
    description:
      "Crypto-comfortable professionals looking for legitimate projects with efficient GCash / Maya fiat off-ramp integration.",
    needs: [
      "GCash / Maya off-ramp integration",
      "Stablecoin payments on Stellar",
      "Access to global Web3 client projects",
      "Verified on-chain work history",
    ],
  },
  {
    id: "scaling-client",
    role: "Client",
    title: "The Scaling Business Client",
    description:
      "SMEs, startups, and NGOs that want reliable remote talent but view hiring as a gamble due to fake reviews and scope disputes.",
    needs: [
      "Coming soon: AI-screened and verified talent pool",
      "Smart contract payment protection",
      "Reduced 20-44 day time-to-hire",
      "Transparent milestone accountability",
    ],
  },
];
