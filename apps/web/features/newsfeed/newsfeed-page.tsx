"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { ProfileAvatar, RouteCallout, RouteEmptyState, RoutePanel } from "@/features/common";
import { useAppMode } from "@/features/mode";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";
import {
  AlertCircle,
  Check,
  Heart,
  LoaderCircle,
  MessageCircle,
  Newspaper,
  Pencil,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { TAppMode } from "@/features/mode";
import type { TNewsfeedPostDto } from "@repo/convex-client";

type TNewsfeedAccess =
  | { state: "loading" }
  | { state: "disabled" }
  | { state: "text-disabled" }
  | { state: "guest" }
  | { state: "incomplete"; next: string }
  | { state: "ready" };

type TApiError = Error & { status?: number };

export const TEXT_LIMIT = 3_000;

export function makeRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    const error = new Error(body?.error ?? "Newsfeed request failed.") as TApiError;
    error.status = response.status;
    throw error;
  }
  return body as T;
}

function countCodePoints(text: string): number {
  return Array.from(text).length;
}

function formatPostDate(timestamp: number): string {
  const delta = timestamp - Date.now();
  const minutes = Math.round(delta / 60_000);
  const hours = Math.round(delta / 3_600_000);
  const days = Math.round(delta / 86_400_000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(days, "day");
}

function PublicationBadge({ mode }: { mode: TAppMode }) {
  return (
    <span className="hr-mode-soft hr-mode-text inline-flex items-center rounded-full border border-(--mode-border) px-2 py-0.5 text-[11px] font-semibold">
      {mode === "freelancer" ? "Freelancer" : "Client"}
    </span>
  );
}

function Composer({
  displayName,
  onPublished,
}: {
  displayName: string;
  onPublished: (post: TNewsfeedPostDto | null) => void;
}) {
  const { mode, setMode } = useAppMode();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!text.trim()) {
      setError("Write something before posting.");
      return;
    }
    if (countCodePoints(text.trim()) > TEXT_LIMIT) {
      setError(`Posts must be ${TEXT_LIMIT.toLocaleString()} characters or less.`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await requestJson<{ post: TNewsfeedPostDto | null }>("/api/newsfeed/posts", {
        method: "POST",
        body: JSON.stringify({ requestId: makeRequestId(), publicationMode: mode, text }),
      });
      setText("");
      onPublished(result.post);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "Post could not be published.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <RoutePanel className="overflow-hidden">
      <div className="border-b px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="hr-text-primary text-sm font-semibold">Share with the community</p>
            <p className="hr-text-secondary mt-1 text-xs">
              Posting as <span className="font-medium">{displayName}</span> ·{" "}
              <PublicationBadge mode={mode} />
            </p>
          </div>
          <div
            className="flex items-center gap-1 rounded-md border p-1"
            aria-label="Publication mode"
          >
            {(["freelancer", "client"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                aria-pressed={mode === option}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  mode === option
                    ? "hr-mode-soft hr-mode-text"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {option === "freelancer" ? "Freelancer" : "Client"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-3 px-5 py-4">
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="What are you working on?"
          aria-label="Post text"
          disabled={pending}
          rows={4}
          className="resize-y"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p
            className={`text-xs ${countCodePoints(text) > TEXT_LIMIT ? "text-destructive" : "hr-text-muted"}`}
          >
            {countCodePoints(text).toLocaleString()} / {TEXT_LIMIT.toLocaleString()} characters ·
            Ctrl/⌘ + Enter to post
          </p>
          <AppButton
            onClick={() => void submit()}
            disabled={pending}
            className="hr-v2-button-primary"
          >
            {pending ? <LoaderCircle className="animate-spin" /> : <Send />}
            Post
          </AppButton>
        </div>
        {error ? (
          <RouteCallout tone="danger" icon={<AlertCircle className="h-4 w-4" />} role="alert">
            {error}
          </RouteCallout>
        ) : null}
      </div>
    </RoutePanel>
  );
}

function ReportForm({
  targetType,
  targetId,
  onClose,
  onSubmitted,
}: {
  targetType: "post" | "comment";
  targetId: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [reason, setReason] = useState("spam");
  const [explanation, setExplanation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      await requestJson("/api/newsfeed/reports", {
        method: "POST",
        body: JSON.stringify({
          requestId: makeRequestId(),
          targetType,
          targetId,
          reason,
          explanation: explanation || undefined,
        }),
      });
      onSubmitted();
      onClose();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Report failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Report {targetType}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close report form"
          className="p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <label className="block text-xs font-medium">
        Reason
        <select
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
        >
          <option value="spam">Spam</option>
          <option value="harassment">Harassment</option>
          <option value="inappropriate_content">Inappropriate content</option>
          <option value="other">Other</option>
        </select>
      </label>
      <Textarea
        value={explanation}
        onChange={(event) => setExplanation(event.target.value)}
        maxLength={1_000}
        rows={3}
        placeholder="Optional context (1,000 characters maximum)"
        aria-label="Report explanation"
      />
      <div className="flex items-center justify-end gap-2">
        {error ? <p className="mr-auto text-xs text-destructive">{error}</p> : null}
        <AppButton variant="outline" size="sm" onClick={onClose}>
          Cancel
        </AppButton>
        <AppButton size="sm" onClick={() => void submit()} disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          Submit report
        </AppButton>
      </div>
    </div>
  );
}

export function NewsfeedPostCard({
  post,
  onChanged,
  onDeleted,
}: {
  post: TNewsfeedPostDto;
  onChanged?: (post: TNewsfeedPostDto) => void;
  onDeleted?: (postId: string) => void;
}) {
  const [liked, setLiked] = useState(post.viewer.liked);
  const [likeCount, setLikeCount] = useState(post.counts.likes);
  const [likePending, setLikePending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.text);
  const [editPending, setEditPending] = useState(false);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    setLiked(post.viewer.liked);
    setLikeCount(post.counts.likes);
    setEditText(post.text);
  }, [post]);

  const updateLike = async () => {
    const next = !liked;
    setLikePending(true);
    try {
      const result = await requestJson<{ liked: boolean; likeCount: number }>(
        `/api/newsfeed/posts/${post.id}/like`,
        { method: "POST", body: JSON.stringify({ liked: next }) },
      );
      setLiked(result.liked);
      setLikeCount(result.likeCount);
    } catch {
      // Keep the previous state after a recoverable interaction failure.
    } finally {
      setLikePending(false);
    }
  };

  const saveEdit = async () => {
    if (!editText.trim() || countCodePoints(editText.trim()) > TEXT_LIMIT) return;
    setEditPending(true);
    try {
      const updated = await requestJson<TNewsfeedPostDto>(`/api/newsfeed/posts/${post.id}`, {
        method: "PATCH",
        body: JSON.stringify({ text: editText }),
      });
      setEditing(false);
      onChanged?.(updated);
    } finally {
      setEditPending(false);
    }
  };

  const deletePost = async () => {
    if (!window.confirm("Delete this post? It will no longer be visible to members.")) return;
    setEditPending(true);
    try {
      await requestJson(`/api/newsfeed/posts/${post.id}`, { method: "DELETE" });
      onDeleted?.(post.id);
    } finally {
      setEditPending(false);
    }
  };

  return (
    <article
      className="rounded-lg border bg-card px-4 py-4 shadow-sm sm:px-5"
      aria-label="Community post"
    >
      <div className="flex items-start gap-3">
        <ProfileAvatar
          avatarUrl={post.author.avatarUrl ?? undefined}
          displayName={post.author.displayName}
          fallbackLabel="U"
          className="h-10 w-10 rounded-full border"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{post.author.displayName}</span>
            <PublicationBadge mode={post.author.publicationMode} />
            <span className="hr-text-muted text-xs">{formatPostDate(post.createdAt)}</span>
            {post.updatedAt !== post.createdAt ? (
              <span className="hr-text-muted text-xs">edited</span>
            ) : null}
          </div>
          {editing ? (
            <div className="mt-3 space-y-2">
              <Textarea
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                rows={4}
                aria-label="Edit post text"
              />
              <div className="flex justify-end gap-2">
                <AppButton variant="outline" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </AppButton>
                <AppButton size="sm" onClick={() => void saveEdit()} disabled={editPending}>
                  Save
                </AppButton>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 break-words whitespace-pre-wrap">{post.text}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => void updateLike()}
              disabled={likePending}
              aria-label={liked ? "Unlike post" : "Like post"}
              aria-pressed={liked}
              className={`inline-flex items-center gap-1.5 rounded px-2 py-1 transition-colors ${liked ? "text-red-600" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              {liked ? <Check className="h-3.5 w-3.5" /> : <Heart className="h-3.5 w-3.5" />}
              {likeCount}
            </button>
            <Link
              href={`/newsfeed/${post.id}`}
              className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {post.counts.comments} comments
            </Link>
            {post.viewer.canEdit ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            ) : null}
            {post.viewer.canDelete ? (
              <button
                type="button"
                onClick={() => void deletePost()}
                disabled={editPending}
                className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            ) : null}
            {post.viewer.canReport ? (
              <button
                type="button"
                onClick={() => setReporting((value) => !value)}
                className="ml-auto rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Report
              </button>
            ) : null}
          </div>
          {reporting ? (
            <ReportForm
              targetType="post"
              targetId={post.id}
              onClose={() => setReporting(false)}
              onSubmitted={() => {}}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

function useNewsfeedPosts(enabled: boolean, identityKey: string | null) {
  const [posts, setPosts] = useState<TNewsfeedPostDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cutoff, setCutoff] = useState<number | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [newPostsAvailable, setNewPostsAvailable] = useState(false);
  const generation = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const lastSeen = useMemo(
    () => posts.reduce((latest, post) => Math.max(latest, post.createdAt), 0),
    [posts],
  );

  const loadFirstPage = useCallback(async () => {
    if (!enabled || !identityKey) return;
    const currentGeneration = ++generation.current;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await requestJson<{
        items: TNewsfeedPostDto[];
        cursor: string;
        hasMore: boolean;
        firstPageCutoff: number;
      }>("/api/newsfeed/posts", { signal: controller.signal });
      if (currentGeneration !== generation.current) return;
      setPosts(result.items);
      setCursor(result.hasMore ? result.cursor : null);
      setCutoff(result.firstPageCutoff);
      setHasMore(result.hasMore);
      setNewPostsAvailable(false);
    } catch (loadError) {
      if (controller.signal.aborted || currentGeneration !== generation.current) return;
      setError(loadError instanceof Error ? loadError.message : "Feed could not be loaded.");
    } finally {
      if (requestController.current === controller) requestController.current = null;
      if (currentGeneration === generation.current) setLoading(false);
    }
  }, [enabled, identityKey]);

  const loadMore = useCallback(async () => {
    if (!cursor || !cutoff || loadingMore) return;
    const currentGeneration = generation.current;
    setLoadingMore(true);
    try {
      const result = await requestJson<{
        items: TNewsfeedPostDto[];
        cursor: string;
        hasMore: boolean;
      }>(`/api/newsfeed/posts?cursor=${encodeURIComponent(cursor)}&cutoff=${cutoff}`);
      if (currentGeneration !== generation.current) return;
      setPosts((current) => [...current, ...result.items]);
      setCursor(result.hasMore ? result.cursor : null);
      setHasMore(result.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "More posts could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, cutoff, loadingMore]);

  const checkForUpdates = useCallback(async () => {
    if (!enabled || !identityKey || !lastSeen) return;
    try {
      const result = await requestJson<{ available: boolean }>(
        `/api/newsfeed/updates?since=${lastSeen}`,
      );
      if (generation.current > 0) setNewPostsAvailable(result.available);
    } catch {
      // Polling is best effort; the visible feed remains stable on failure.
    }
  }, [enabled, identityKey, lastSeen]);

  useEffect(() => {
    if (!enabled || !identityKey) {
      generation.current += 1;
      requestController.current?.abort();
      requestController.current = null;
      setPosts([]);
      setCursor(null);
      setCutoff(null);
      setHasMore(false);
      setNewPostsAvailable(false);
      setLoading(false);
      return;
    }
    void loadFirstPage();
    return () => {
      generation.current += 1;
      requestController.current?.abort();
      requestController.current = null;
    };
  }, [enabled, identityKey, loadFirstPage]);

  useEffect(() => {
    if (!enabled || !identityKey) return;
    const interval = window.setInterval(() => void checkForUpdates(), 30_000);
    const onFocus = () => void checkForUpdates();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkForUpdates, enabled, identityKey]);

  const replacePost = (next: TNewsfeedPostDto) =>
    setPosts((current) => current.map((post) => (post.id === next.id ? next : post)));
  const removePost = (postId: string) =>
    setPosts((current) => current.filter((post) => post.id !== postId));

  return {
    posts,
    loading,
    loadingMore,
    error,
    hasMore,
    newPostsAvailable,
    loadFirstPage,
    loadMore,
    replacePost,
    removePost,
  };
}

export function NewsfeedPage() {
  const [access, setAccess] = useState<TNewsfeedAccess>({ state: "loading" });
  const { authSession } = useWallet();
  const identityKey = authSession?.address ?? null;

  useEffect(() => {
    let isCurrent = true;
    void fetch("/api/newsfeed/access", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          next?: string;
          textEnabled?: boolean;
        } | null;
        if (!isCurrent) return;
        if (response.status === 404) setAccess({ state: "disabled" });
        else if (response.status === 403)
          setAccess({ state: "incomplete", next: body?.next ?? "/onboarding?next=%2Fnewsfeed" });
        else if (response.status === 401) setAccess({ state: "guest" });
        else if (response.ok && body?.textEnabled === false) setAccess({ state: "text-disabled" });
        else if (response.ok) setAccess({ state: "ready" });
        else setAccess({ state: "guest" });
      })
      .catch(() => {
        if (isCurrent) setAccess({ state: "guest" });
      });
    return () => {
      isCurrent = false;
    };
  }, [identityKey]);

  if (access.state === "loading")
    return <p className="text-sm text-muted-foreground">Checking Newsfeed access…</p>;
  if (access.state === "disabled") {
    return (
      <RoutePanel className="max-w-2xl">
        <div className="space-y-2 px-5 py-5">
          <p className="font-semibold">Community is coming soon</p>
          <p className="hr-text-secondary text-sm">
            The member community is currently unavailable.
          </p>
        </div>
      </RoutePanel>
    );
  }
  if (access.state === "text-disabled") {
    return (
      <RoutePanel className="max-w-2xl">
        <div className="space-y-3 px-5 py-5">
          <p className="flex items-center gap-2 font-semibold">
            <Newspaper className="h-4 w-4" />
            Community shell
          </p>
          <p className="hr-text-secondary text-sm">
            Verified member access is active. Text publishing will appear here after the beta
            acceptance checks are complete.
          </p>
        </div>
      </RoutePanel>
    );
  }
  if (access.state === "guest") {
    return (
      <RoutePanel className="max-w-2xl">
        <div className="space-y-3 px-5 py-5">
          <p className="font-semibold">Sign in to enter Newsfeed</p>
          <RouteCallout tone="neutral">
            No community content is loaded until access is verified.
          </RouteCallout>
        </div>
      </RoutePanel>
    );
  }
  if (access.state === "incomplete") {
    return (
      <RoutePanel className="max-w-2xl">
        <div className="space-y-3 px-5 py-5">
          <p className="font-semibold">Finish your profile first</p>
          <p className="hr-text-secondary text-sm">
            Newsfeed uses your named profile for attribution.
          </p>
          <AppButton asChild className="hr-v2-button-primary">
            <Link href={access.next}>Complete profile</Link>
          </AppButton>
        </div>
      </RoutePanel>
    );
  }

  return (
    <NewsfeedFeed
      identityKey={identityKey}
      displayName={authSession?.profile?.name?.trim() || "You"}
    />
  );
}

function NewsfeedFeed({
  identityKey,
  displayName,
}: {
  identityKey: string | null;
  displayName: string;
}) {
  const feed = useNewsfeedPosts(true, identityKey);
  const [lastPublished, setLastPublished] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="space-y-1">
        <p className="hr-text-muted font-mono text-xs uppercase">Community</p>
        <h1 className="hr-text-primary text-2xl font-semibold tracking-tight">Newsfeed</h1>
        <p className="hr-text-secondary text-sm">A shared space for verified Highrable members.</p>
      </header>
      <Composer
        key={identityKey ?? "signed-out"}
        displayName={displayName}
        onPublished={(post) => {
          setLastPublished(post?.id ?? makeRequestId());
          void feed.loadFirstPage();
        }}
      />
      {lastPublished ? (
        <span className="sr-only" role="status">
          Post published.
        </span>
      ) : null}
      {feed.newPostsAvailable ? (
        <button
          type="button"
          onClick={() => void feed.loadFirstPage()}
          className="mx-auto flex items-center gap-2 rounded-full border border-(--mode-border) bg-[var(--mode-soft)] px-4 py-2 text-sm font-medium text-(--mode-text)"
        >
          <RefreshCw className="h-4 w-4" /> New posts available
        </button>
      ) : null}
      {feed.error && feed.posts.length === 0 ? (
        <RouteEmptyState
          title="Feed unavailable"
          description={feed.error}
          icon={<AlertCircle />}
          action={
            <AppButton variant="outline" size="sm" onClick={() => void feed.loadFirstPage()}>
              Retry
            </AppButton>
          }
        />
      ) : null}
      {feed.loading && feed.posts.length === 0 ? (
        <div className="flex justify-center py-8">
          <LoaderCircle className="animate-spin text-muted-foreground" />
        </div>
      ) : null}
      {!feed.loading && !feed.error && feed.posts.length === 0 ? (
        <RouteEmptyState
          title="No posts yet"
          description="Start the conversation with the first community post."
          icon={<Newspaper />}
        />
      ) : null}
      <div className="space-y-4">
        {feed.posts.map((post) => (
          <NewsfeedPostCard
            key={post.id}
            post={post}
            onChanged={feed.replacePost}
            onDeleted={feed.removePost}
          />
        ))}
      </div>
      {feed.error && feed.posts.length > 0 ? (
        <RouteCallout tone="danger" icon={<AlertCircle className="h-4 w-4" />}>
          {feed.error}
        </RouteCallout>
      ) : null}
      {feed.hasMore ? (
        <div className="flex justify-center">
          <AppButton
            variant="outline"
            onClick={() => void feed.loadMore()}
            disabled={feed.loadingMore}
          >
            {feed.loadingMore ? <LoaderCircle className="animate-spin" /> : null}Load more
          </AppButton>
        </div>
      ) : null}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Members only · plain text beta
      </div>
    </div>
  );
}
