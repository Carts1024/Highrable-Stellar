export type TNewsfeedPublicationMode = "freelancer" | "client";
export type TNewsfeedVisibility = "visible" | "moderation_hidden" | "author_deleted";
export type TNewsfeedReportTarget = "post" | "comment";
export type TNewsfeedReportReason = "spam" | "harassment" | "inappropriate_content" | "other";
export type TNewsfeedReportStatus = "open" | "reviewed" | "dismissed";
export type TNewsfeedModerationAction = "hide" | "restore" | "dismiss_report";

export type TNewsfeedAuthorDto = {
  displayName: string;
  avatarUrl: string | null;
  available: boolean;
  publicationMode?: TNewsfeedPublicationMode;
};

export type TNewsfeedPostDto = {
  id: string;
  text: string;
  createdAt: number;
  updatedAt: number;
  visibility: TNewsfeedVisibility;
  author: TNewsfeedAuthorDto & { publicationMode: TNewsfeedPublicationMode };
  counts: { likes: number; comments: number };
  viewer: {
    liked: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canReport: boolean;
    isModerator: boolean;
  };
};

export type TNewsfeedCommentDto = {
  id: string;
  postId: string;
  text: string;
  createdAt: number;
  updatedAt: number;
  visibility: TNewsfeedVisibility;
  author: TNewsfeedAuthorDto & { publicationMode: TNewsfeedPublicationMode };
  viewer: {
    canEdit: boolean;
    canDelete: boolean;
    canReport: boolean;
    isModerator: boolean;
  };
};

export type TNewsfeedCursorPage<T> = {
  items: T[];
  cursor: string;
  hasMore: boolean;
};

export type TNewsfeedPostPage = TNewsfeedCursorPage<TNewsfeedPostDto> & {
  firstPageCutoff: number;
};

export type TNewsfeedReportDto = {
  id: string;
  reason: TNewsfeedReportReason;
  explanation: string | null;
  status: TNewsfeedReportStatus;
  createdAt: number;
  reviewedAt: number | null;
  reporter: TNewsfeedAuthorDto;
  target: {
    id: string;
    type: TNewsfeedReportTarget;
    text: string;
    visibility: TNewsfeedVisibility;
    author: TNewsfeedAuthorDto & { publicationMode: TNewsfeedPublicationMode };
  } | null;
};
