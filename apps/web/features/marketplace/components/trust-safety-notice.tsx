import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { cn } from "@repo/ui/lib/utils";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

export type TTrustSafetyNoticeType =
  | "unfunded"
  | "off_platform"
  | "selected_unfunded"
  | "client_funding"
  | "verified_funded";

interface ITrustSafetyNoticeProps {
  readonly type: TTrustSafetyNoticeType;
  readonly compact?: boolean;
  readonly className?: string;
}

const NOTICE_COPY: Record<TTrustSafetyNoticeType, { message: string; tone: "amber" | "green" }> = {
  unfunded: {
    message:
      "This job is not funded yet. Apply if interested, but do not begin work until escrow is funded.",
    tone: "amber",
  },
  off_platform: {
    message:
      "Stay protected: keep payment and work approval inside Highrable escrow. Off-platform requests may bypass payment protection.",
    tone: "amber",
  },
  selected_unfunded: {
    message: "You were selected, but do not start yet. Wait until the client funds escrow.",
    tone: "amber",
  },
  client_funding: {
    message: "Funding escrow builds freelancer trust and helps prevent scam concerns.",
    tone: "amber",
  },
  verified_funded: {
    message: "Verified Funded: stablecoin funds are locked in Stellar escrow.",
    tone: "green",
  },
};

export function TrustSafetyNotice({ type, compact = false, className }: ITrustSafetyNoticeProps) {
  const notice = NOTICE_COPY[type];
  const Icon =
    notice.tone === "green" ? CheckCircle2 : type === "off_platform" ? ShieldCheck : AlertTriangle;

  return (
    <Alert
      className={cn(
        "items-center rounded-lg font-sans",
        notice.tone === "green"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-900",
        compact ? "px-3 py-2 text-xs" : null,
        className,
      )}
      role={notice.tone === "green" ? "status" : "note"}
    >
      <Icon className={cn("h-4 w-4 shrink-0", compact ? "h-3.5 w-3.5" : null)} />
      <AlertDescription className={compact ? "text-xs" : undefined}>
        {notice.message}
      </AlertDescription>
    </Alert>
  );
}
