export type TScamRiskLevel = "low" | "medium" | "high";

export type TScamSignal = {
  type: string;
  message: string;
};

export type TScamSignalAnalysis = {
  riskLevel: TScamRiskLevel;
  signals: TScamSignal[];
  isBlocked: boolean;
};

type TScamPattern = {
  type: string;
  message: string;
  pattern: RegExp;
  severity: Exclude<TScamRiskLevel, "low">;
  blocksCreation?: boolean;
};

export const DISALLOWED_JOB_POST_MESSAGE =
  "Job posts asking for seed phrases, private keys, or upfront crypto payments are not allowed.";

const SCAM_PATTERNS: TScamPattern[] = [
  {
    type: "off_platform_contact",
    message: "Mentions off-platform contact channels such as Telegram, WhatsApp, or Discord.",
    pattern: /\b(telegram|whatsapp|discord)\b/i,
    severity: "medium",
  },
  {
    type: "upfront_payment",
    message: "Asks the freelancer to pay a fee or deposit upfront.",
    pattern:
      /\b(pay a fee|deposit required|processing fee|verification fee|kindly send deposit)\b/i,
    severity: "high",
  },
  {
    type: "crypto_first",
    message: "Asks the freelancer to send crypto first.",
    pattern: /\b(send crypto first|send (?:your )?crypto)\b/i,
    severity: "high",
    blocksCreation: true,
  },
  {
    type: "credential_theft",
    message: "Asks for wallet seed phrases, recovery phrases, or private keys.",
    pattern: /\b(seed phrase|private key|recovery phrase|send your recovery phrase)\b/i,
    severity: "high",
    blocksCreation: true,
  },
  {
    type: "suspicious_software",
    message: "Asks the freelancer to install suspicious software.",
    pattern: /\b(install this app|install this software|download this app)\b/i,
    severity: "medium",
  },
  {
    type: "no_escrow",
    message: "Suggests moving payment outside escrow.",
    pattern: /\b(payment outside escrow|outside escrow|no escrow|payment outside|off platform)\b/i,
    severity: "medium",
  },
  {
    type: "outside_highrable",
    message: "Suggests continuing outside Highrable.",
    pattern: /\b(outside highrable|continue outside highrable)\b/i,
    severity: "medium",
  },
  {
    type: "unrealistic_earnings",
    message: "Promises unrealistic earnings.",
    pattern: /\b(guaranteed\s+\$?\d{3,}(?:\/| per )day|guaranteed money|easy \$?\d{3,})\b/i,
    severity: "medium",
  },
];

export function analyzeJobScamSignals(args: {
  title: string;
  description: string;
}): TScamSignalAnalysis {
  const content = `${args.title} ${args.description}`;
  const matchedPatterns = SCAM_PATTERNS.filter((signalPattern) =>
    signalPattern.pattern.test(content),
  );
  const signals = matchedPatterns.map(({ type, message }) => ({ type, message }));
  const isBlocked = matchedPatterns.some((signalPattern) => signalPattern.blocksCreation === true);
  const hasHighRisk = matchedPatterns.some((signalPattern) => signalPattern.severity === "high");

  return {
    riskLevel: isBlocked || hasHighRisk ? "high" : signals.length > 0 ? "medium" : "low",
    signals,
    isBlocked,
  };
}
