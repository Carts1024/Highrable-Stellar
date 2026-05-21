export type TAttachmentType =
  | "image"
  | "video"
  | "video_link"
  | "link"
  | "document"
  | "pdf"
  | "markdown"
  | "file";

export type TAttachmentVisibility = "private" | "participants" | "public" | "admin_only";

export type TWalletType = "external_wallet" | "passkey_smart_account";

export type TAttachmentProtectionMode = "standard" | "protected_preview" | "download_restricted";

export type TAttachmentViewerRole =
  | "client"
  | "assigned_freelancer"
  | "dispute_participant"
  | "dispute_reviewer"
  | "admin"
  | "owner"
  | "public";

export type TAttachmentProtectionSummary = {
  mode: TAttachmentProtectionMode;
  isProtected: boolean;
  previewAllowed: boolean;
  downloadAllowed: boolean;
  watermarkEnabled: boolean;
  accessLoggingEnabled: boolean;
  viewerRole?: TAttachmentViewerRole | null;
  previewSupported: boolean;
  downloadRestricted: boolean;
  protectedReason?: string | null;
  notice?: string | null;
};

export type TDraftAttachment = {
  id: string;
  name: string;
  type: TAttachmentType;
  size?: number;
  mimeType?: string;
  externalUrl?: string;
  url?: string | null;
  status: "ready" | "uploading" | "failed";
  error?: string;
};

export type TAttachmentUploaderWallet = {
  walletAddress: string | null;
  walletType: TWalletType | null;
};
