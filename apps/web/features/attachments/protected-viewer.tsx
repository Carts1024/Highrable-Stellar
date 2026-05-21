"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { useMutation, useQuery } from "convex/react";
import { Download, Eye, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  TAttachmentProtectionSummary,
  TAttachmentType,
  TWalletType,
} from "@/features/attachments/types";
import type { TConvexDoc, TConvexId } from "@repo/convex-client";
import type { ReactNode } from "react";

type TProtectedAttachment = TConvexDoc<"attachments"> & {
  url?: string | null;
  protection?: TAttachmentProtectionSummary;
};

type TProtectedPreviewResult = {
  url: string | null;
  expiresAt: number;
  watermark: { text: string; renderedAt: number };
};

interface IProtectedAttachmentDialogProps {
  readonly attachment: TProtectedAttachment;
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function AttachmentProtectionBadge({
  protection,
}: {
  readonly protection?: TAttachmentProtectionSummary;
}) {
  if (!protection?.isProtected) {
    return null;
  }

  return (
    <Badge className="rounded-md border border-[#ffd7bd] bg-[#fff7f1] px-2 py-1 font-mono text-[0.65rem] tracking-[0.06em] text-[#9a3d00] uppercase hover:bg-[#fff7f1]">
      Protected preview
    </Badge>
  );
}

export function ProtectionNotice() {
  return (
    <div className="rounded-lg border border-[#ffd7bd] bg-[#fff7f1] p-3 text-sm text-[#5f2a00]">
      Protected until payment release. You can preview this work, but downloads are restricted until
      the freelancer is paid. Agreement context may keep downloads restricted during cancellation or
      dispute review unless the platform-reviewed outcome explicitly allows access.
    </div>
  );
}

export function DownloadRestrictedNotice() {
  return (
    <p className="rounded-lg border border-dashed border-[#d8d8d8] bg-[#fafafa] p-3 text-sm text-[#5f5f5f]">
      Download unlocks after funds are released. This protects freelancers from unpaid use of
      submitted work.
    </p>
  );
}

export function PaymentReleasedNotice() {
  return (
    <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
      Payment released. Deliverables are now available for download.
    </p>
  );
}

export function WatermarkOverlay({ text }: { readonly text: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden opacity-30"
      style={{
        backgroundImage: `repeating-linear-gradient( -28deg, transparent 0 64px, rgba(10,10,10,0.08) 64px 66px, transparent 66px 156px )`,
      }}
    >
      <div className="grid h-full w-full grid-cols-2 content-around gap-10 p-8 text-center font-mono text-xs font-semibold text-[#0a0a0a] uppercase sm:grid-cols-3">
        {Array.from({ length: 12 }).map((_, index) => (
          <span key={index} className="-rotate-12 whitespace-nowrap select-none">
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProtectedAttachmentShell({
  children,
  watermarkText,
  isInactive,
  onDeterrent,
}: {
  readonly children: ReactNode;
  readonly watermarkText: string;
  readonly isInactive: boolean;
  readonly onDeterrent: (action: "copy_attempt_blocked" | "print_attempt_blocked") => void;
}) {
  return (
    <div
      className="relative min-h-[280px] overflow-hidden rounded-lg border border-[#e8e8e8] bg-white"
      onContextMenu={(event) => event.preventDefault()}
      onCopy={(event) => {
        event.preventDefault();
        onDeterrent("copy_attempt_blocked");
      }}
      style={{ WebkitUserSelect: "none", userSelect: "none" }}
    >
      {children}
      <WatermarkOverlay text={watermarkText} />
      {isInactive ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-white/90 p-6 text-center">
          <div>
            <ShieldCheck className="mx-auto h-8 w-8 text-[#FF7003]" />
            <p className="mt-3 text-sm font-semibold text-[#0a0a0a]">
              Protected content hidden while inactive
            </p>
            <p className="mt-1 text-xs text-[#5f5f5f]">Watermarked and access logged.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProtectedImagePreview({ url, name }: { readonly url: string; readonly name: string }) {
  return (
    <img
      src={url}
      alt={name}
      draggable={false}
      className="mx-auto max-h-[65vh] w-full object-contain"
    />
  );
}

function ProtectedPdfPreview({ url, name }: { readonly url: string; readonly name: string }) {
  return <iframe title={name} src={url} className="h-[65vh] w-full bg-white" />;
}

function ProtectedVideoPreview({ url }: { readonly url: string }) {
  return (
    <video
      src={url}
      controls
      controlsList="nodownload noplaybackrate"
      className="w-full"
      aria-label="Protected video preview"
    >
      <track kind="captions" />
    </video>
  );
}

function ProtectedMarkdownPreview({ url }: { readonly url: string }) {
  const [content, setContent] = useState("Loading preview...");

  useEffect(() => {
    let isMounted = true;
    void fetch(url)
      .then((response) => response.text())
      .then((text) => {
        if (isMounted) setContent(text.slice(0, 20000));
      })
      .catch(() => {
        if (isMounted) setContent("Preview is not available for this file type.");
      });
    return () => {
      isMounted = false;
    };
  }, [url]);

  return (
    <pre className="max-h-[65vh] overflow-auto p-4 text-sm leading-6 whitespace-pre-wrap text-[#0a0a0a]">
      {content}
    </pre>
  );
}

function UnsupportedProtectedPreview() {
  return (
    <div className="grid min-h-[280px] place-items-center p-6 text-center">
      <div>
        <p className="text-sm font-semibold text-[#0a0a0a]">
          Preview is not available for this file type.
        </p>
        <p className="mt-2 text-sm text-[#5f5f5f]">Download is restricted by the owner.</p>
      </div>
    </div>
  );
}

function ProtectedPreviewBody({
  attachment,
  preview,
}: {
  readonly attachment: TProtectedAttachment;
  readonly preview: TProtectedPreviewResult | null;
}) {
  const url = preview?.url;
  const type = attachment.type as TAttachmentType;

  if (!url) {
    return <UnsupportedProtectedPreview />;
  }

  if (type === "image") return <ProtectedImagePreview url={url} name={attachment.name} />;
  if (type === "pdf") return <ProtectedPdfPreview url={url} name={attachment.name} />;
  if (type === "video") return <ProtectedVideoPreview url={url} />;
  if (type === "markdown") return <ProtectedMarkdownPreview url={url} />;
  if (type === "link" || type === "video_link") {
    return (
      <div className="p-4">
        <p className="text-sm text-[#5f5f5f]">
          External sites are outside Highrable content protection controls.
        </p>
        <a
          className="mt-2 block text-sm font-semibold break-all text-[#FF7003]"
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          {url}
        </a>
      </div>
    );
  }

  return <UnsupportedProtectedPreview />;
}

export function AttachmentAccessLogsPanel({
  attachmentId,
  viewerWallet,
}: {
  readonly attachmentId: TConvexId<"attachments">;
  readonly viewerWallet?: string | null;
}) {
  const logs = useQuery(
    api.attachments.getAttachmentAccessLogs,
    viewerWallet ? { attachmentId, viewerWallet } : "skip",
  );

  if (!logs || logs.length === 0) {
    return null;
  }

  return (
    <div className="max-h-44 overflow-auto rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
      <p className="text-xs font-semibold text-[#0a0a0a]">Access logged</p>
      <div className="mt-2 space-y-2">
        {logs.slice(0, 12).map((log) => (
          <div key={log._id} className="grid gap-1 text-xs text-[#5f5f5f] sm:grid-cols-[1fr_auto]">
            <span>
              {log.viewerRole?.replace(/_/g, " ") ?? "viewer"} ·{" "}
              {shortenWalletAddress(log.viewerWallet)} · {log.action.replace(/_/g, " ")}
            </span>
            <span>{new Date(log.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProtectedAttachmentDialog({
  attachment,
  isOpen,
  onOpenChange,
}: IProtectedAttachmentDialogProps) {
  const walletIdentity = useHighrableWalletIdentity();
  const recordPreviewOpened = useMutation(api.attachments.recordProtectedPreviewOpened);
  const recordDownloadAttempt = useMutation(api.attachments.recordDownloadAttempt);
  const logAttachmentAccess = useMutation(api.attachments.logAttachmentAccess);
  const [preview, setPreview] = useState<TProtectedPreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInactive, setIsInactive] = useState(false);
  const sessionId = useMemo(createSessionId, [attachment._id]);

  useEffect(() => {
    if (!isOpen || !walletIdentity.walletAddress) {
      return;
    }

    setError(null);
    void recordPreviewOpened({
      attachmentId: attachment._id,
      viewerWallet: walletIdentity.walletAddress,
      ...(walletIdentity.walletType
        ? { viewerWalletType: walletIdentity.walletType as TWalletType }
        : {}),
      sessionId,
    })
      .then((result) => setPreview(result as TProtectedPreviewResult))
      .catch((caughtError) => {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "You do not have access to this attachment.";
        setError(message);
      });
  }, [
    attachment._id,
    isOpen,
    recordPreviewOpened,
    sessionId,
    walletIdentity.walletAddress,
    walletIdentity.walletType,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    const handleVisibility = () => {
      const hidden = document.hidden;
      setIsInactive(hidden);
      if (hidden && walletIdentity.walletAddress) {
        void logAttachmentAccess({
          attachmentId: attachment._id,
          viewerWallet: walletIdentity.walletAddress,
          ...(walletIdentity.walletType ? { viewerWalletType: walletIdentity.walletType } : {}),
          action: "visibility_hidden",
          result: "allowed",
          sessionId,
        });
      }
    };
    const handleBlur = () => setIsInactive(true);
    const handleFocus = () => setIsInactive(false);
    const handleBeforePrint = () => {
      setIsInactive(true);
      if (walletIdentity.walletAddress) {
        void logAttachmentAccess({
          attachmentId: attachment._id,
          viewerWallet: walletIdentity.walletAddress,
          ...(walletIdentity.walletType ? { viewerWalletType: walletIdentity.walletType } : {}),
          action: "print_attempt_blocked",
          result: "blocked",
          reason: "Print action blocked inside protected preview.",
          sessionId,
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("beforeprint", handleBeforePrint);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("beforeprint", handleBeforePrint);
    };
  }, [
    attachment._id,
    isOpen,
    logAttachmentAccess,
    sessionId,
    walletIdentity.walletAddress,
    walletIdentity.walletType,
  ]);

  const logDeterrent = (action: "copy_attempt_blocked" | "print_attempt_blocked") => {
    if (!walletIdentity.walletAddress) return;
    void logAttachmentAccess({
      attachmentId: attachment._id,
      viewerWallet: walletIdentity.walletAddress,
      ...(walletIdentity.walletType ? { viewerWalletType: walletIdentity.walletType } : {}),
      action,
      result: "blocked",
      sessionId,
    });
  };

  const handleDownloadAttempt = async () => {
    if (!walletIdentity.walletAddress) {
      setError("Missing wallet identity.");
      return;
    }

    try {
      const result = await recordDownloadAttempt({
        attachmentId: attachment._id,
        viewerWallet: walletIdentity.walletAddress,
        ...(walletIdentity.walletType ? { viewerWalletType: walletIdentity.walletType } : {}),
        sessionId,
      });
      if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Download is restricted for this attachment.";
      setError(message);
    }
  };

  const protection = attachment.protection;
  const watermarkText =
    preview?.watermark.text ??
    `Highrable · ${protection?.viewerRole?.replace(/_/g, " ") ?? "viewer"} · ${shortenWalletAddress(
      walletIdentity.walletAddress,
    )} · Access logged`;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-auto border-[#e8e8e8] bg-white">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-xl text-[#0a0a0a]">
            <Eye className="h-5 w-5 text-[#FF7003]" />
            Protected preview
            <AttachmentProtectionBadge protection={protection} />
          </DialogTitle>
          <DialogDescription className="text-[#5f5f5f]">
            {attachment.name} · Watermarked and access logged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <ProtectionNotice />
          {protection?.downloadRestricted ? <DownloadRestrictedNotice /> : null}
          {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <ProtectedAttachmentShell
            watermarkText={watermarkText}
            isInactive={isInactive}
            onDeterrent={logDeterrent}
          >
            <ProtectedPreviewBody attachment={attachment} preview={preview} />
          </ProtectedAttachmentShell>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#7f7f7f]">
              Anti-leak deterrents are active for this watermarked preview.
            </p>
            <AppButton
              type="button"
              variant="outline"
              disabled={protection?.downloadRestricted}
              onClick={() => void handleDownloadAttempt()}
              className="rounded-lg border-[#d8d8d8] text-[#0a0a0a]"
            >
              <Download className="mr-2 h-4 w-4" />
              {protection?.downloadRestricted ? "Download restricted" : "Download"}
            </AppButton>
          </div>
          <AttachmentAccessLogsPanel
            attachmentId={attachment._id}
            viewerWallet={walletIdentity.walletAddress}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
