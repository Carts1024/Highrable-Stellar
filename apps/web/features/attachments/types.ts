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
