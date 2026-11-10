"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { ProfileAvatar, RouteCallout, RouteEmptyState, RoutePanel } from "@/features/common";
import { useAppMode } from "@/features/mode";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";
import {
  AlertCircle,
  ArrowLeft,
  LoaderCircle,
  MessageCircle,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { TNewsfeedCommentDto, TNewsfeedPostDto } from "@repo/convex-client";

import { NewsfeedPostCard, TEXT_LIMIT, makeRequestId, requestJson } from "./newsfeed-page";

function ModeBadge({ mode }: { mode: "freelancer" | "client" }) {
  return (
    <span className="hr-mode-soft hr-mode-text inline-flex rounded-full border border-(--mode-border) px-2 py-0.5 text-[11px] font-semibold">
      {mode === "freelancer" ? "Freelancer" : "Client"}
    </span>
  );
}

function CommentCard({
  comment,
  onChanged,
  onDeleted,
}: {
  comment: TNewsfeedCommentDto;
  onChanged: (comment: TNewsfeedCommentDto) => void;
  onDeleted: (commentId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.text);
  const [pending, setPending] = useState(false);
  const [reporting, setReporting] = useState(false);

  useEffect(() => setText(comment.text), [comment.text]);

  const save = async () => {
    if (!text.trim() || Array.from(text.trim()).length > TEXT_LIMIT) return;
    setPending(true);
    try {
      await requestJson(`/api/newsfeed/comments/${comment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ text }),
      });
      onChanged({ ...comment, text: text.trim(), updatedAt: Date.now() });
      setEditing(false);
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this comment?")) return;
    setPending(true);
    try {
      await requestJson(`/api/newsfeed/comments/${comment.id}`, { method: "DELETE" });
      onDeleted(comment.id);
    } finally {
      setPending(false);
    }
  };

  return (
    <article className="border-b px-5 py-4 last:border-b-0" aria-label="Community comment">
      <div className="flex items-start gap-3">
        <ProfileAvatar
          avatarUrl={comment.author.avatarUrl ?? undefined}
          displayName={comment.author.displayName}
          fallbackLabel="U"
          className="h-8 w-8 rounded-full border"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{comment.author.displayName}</span>
            <ModeBadge mode={comment.author.publicationMode} />
            <span className="hr-text-muted text-xs">
              {new Date(comment.createdAt).toLocaleString()}
            </span>
          </div>
          {editing ? (
            <div className="mt-2 space-y-2">
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={3}
                aria-label="Edit comment text"
              />
              <div className="flex justify-end gap-2">
                <AppButton variant="outline" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </AppButton>
                <AppButton size="sm" onClick={() => void save()} disabled={pending}>
                  Save
                </AppButton>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 break-words whitespace-pre-wrap">{comment.text}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {comment.viewer.canEdit ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            ) : null}
            {comment.viewer.canDelete ? (
              <button
                type="button"
                onClick={() => void remove()}
                disabled={pending}
                className="inline-flex items-center gap-1 hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            ) : null}
            {comment.viewer.canReport ? (
              <button
                type="button"
                onClick={() => setReporting((value) => !value)}
                className="ml-auto hover:text-foreground"
              >
                Report
              </button>
            ) : null}
          </div>
          {reporting ? (
            <div className="mt-2 flex items-center gap-2 rounded border bg-muted/20 p-2 text-xs">
              <span className="flex-1">Report this comment?</span>
              <AppButton
                size="sm"
                onClick={async () => {
                  await requestJson("/api/newsfeed/reports", {
                    method: "POST",
                    body: JSON.stringify({
                      requestId: makeRequestId(),
                      targetType: "comment",
                      targetId: comment.id,
                      reason: "other",
                    }),
                  });
                  setReporting(false);
                }}
              >
                Report
              </AppButton>
              <button type="button" onClick={() => setReporting(false)} aria-label="Close report">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function NewsfeedPostDetailPage({ postId }: { postId: string }) {
  const { authSession } = useWallet();
  const { mode } = useAppMode();
  const [post, setPost] = useState<TNewsfeedPostDto | null>(null);
  const [comments, setComments] = useState<TNewsfeedCommentDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentPending, setCommentPending] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    void requestJson<TNewsfeedPostDto>(`/api/newsfeed/posts/${postId}`)
      .then((result) => {
        if (current) setPost(result);
      })
      .catch((loadError) => {
        if (current)
          setError(loadError instanceof Error ? loadError.message : "Post could not be loaded.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [authSession?.address, postId]);

  const loadComments = async (reset = false) => {
    setCommentsLoading(true);
    try {
      const activeCursor = reset ? null : cursor;
      const result = await requestJson<{
        items: TNewsfeedCommentDto[];
        cursor: string;
        hasMore: boolean;
      }>(
        `/api/newsfeed/posts/${postId}/comments${activeCursor ? `?cursor=${encodeURIComponent(activeCursor)}` : ""}`,
      );
      setComments((current) => (reset ? result.items : [...current, ...result.items]));
      setCursor(result.hasMore ? result.cursor : null);
      setHasMore(result.hasMore);
    } catch (loadError) {
      setCommentError(
        loadError instanceof Error ? loadError.message : "Comments could not be loaded.",
      );
    } finally {
      setCommentsLoading(false);
    }
  };

  useEffect(() => {
    if (post) void loadComments(true);
  }, [post?.id, authSession?.address]);

  const submitComment = async () => {
    if (!commentText.trim()) {
      setCommentError("Write a comment before posting.");
      return;
    }
    if (Array.from(commentText.trim()).length > TEXT_LIMIT) {
      setCommentError(`Comments must be ${TEXT_LIMIT.toLocaleString()} characters or less.`);
      return;
    }
    setCommentPending(true);
    setCommentError(null);
    try {
      await requestJson(`/api/newsfeed/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({
          requestId: makeRequestId(),
          publicationMode: mode,
          text: commentText,
        }),
      });
      setCommentText("");
      setPost((current) =>
        current
          ? { ...current, counts: { ...current.counts, comments: current.counts.comments + 1 } }
          : current,
      );
      await loadComments(true);
    } catch (submissionError) {
      setCommentError(
        submissionError instanceof Error ? submissionError.message : "Comment could not be posted.",
      );
    } finally {
      setCommentPending(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-10">
        <LoaderCircle className="animate-spin text-muted-foreground" />
      </div>
    );
  if (error || !post)
    return (
      <RouteEmptyState
        title="Post unavailable"
        description={error ?? "This post is no longer available."}
        icon={<AlertCircle />}
        action={
          <AppButton asChild variant="outline">
            <Link href="/newsfeed">
              <ArrowLeft />
              Back to Newsfeed
            </Link>
          </AppButton>
        }
      />
    );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/newsfeed"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Newsfeed
      </Link>
      <NewsfeedPostCard
        post={post}
        onChanged={setPost}
        onDeleted={() => {
          window.location.href = "/newsfeed";
        }}
      />
      <RoutePanel className="overflow-hidden">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <MessageCircle className="h-4 w-4" />
          <h2 className="font-semibold">Comments</h2>
        </div>
        <div className="space-y-3 border-b px-5 py-4">
          <p className="text-xs text-muted-foreground">
            Commenting as {authSession?.profile?.name ?? "You"} · <ModeBadge mode={mode} />
          </p>
          <Textarea
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            rows={3}
            placeholder="Add a thoughtful comment"
            aria-label="Comment text"
            disabled={commentPending}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {Array.from(commentText).length.toLocaleString()} / {TEXT_LIMIT.toLocaleString()}
            </p>
            <AppButton onClick={() => void submitComment()} disabled={commentPending}>
              {commentPending ? <LoaderCircle className="animate-spin" /> : null}Comment
            </AppButton>
          </div>
          {commentError ? (
            <RouteCallout tone="danger" icon={<AlertCircle className="h-4 w-4" />}>
              {commentError}
            </RouteCallout>
          ) : null}
        </div>
        {commentsLoading && comments.length === 0 ? (
          <div className="flex justify-center py-6">
            <LoaderCircle className="animate-spin text-muted-foreground" />
          </div>
        ) : null}
        {!commentsLoading && comments.length === 0 ? (
          <div className="px-5 py-6">
            <RouteEmptyState description="No comments yet." icon={<MessageCircle />} />
          </div>
        ) : null}
        {comments.map((comment) => (
          <CommentCard
            key={comment.id}
            comment={comment}
            onChanged={(next) =>
              setComments((current) => current.map((item) => (item.id === next.id ? next : item)))
            }
            onDeleted={(commentId) => {
              setComments((current) => current.filter((item) => item.id !== commentId));
              setPost((current) =>
                current
                  ? {
                      ...current,
                      counts: {
                        ...current.counts,
                        comments: Math.max(current.counts.comments - 1, 0),
                      },
                    }
                  : current,
              );
            }}
          />
        ))}
        {hasMore ? (
          <div className="flex justify-center border-t px-5 py-4">
            <AppButton
              variant="outline"
              onClick={() => void loadComments()}
              disabled={commentsLoading}
            >
              Load more comments
            </AppButton>
          </div>
        ) : null}
      </RoutePanel>
    </div>
  );
}
