"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { useEffect, useRef, useState } from "react";

import type { TNewsfeedPostDto } from "@repo/convex-client";

const MAX_VIDEO_BYTES = 26_214_400;
const MAX_VIDEO_SECONDS = 60;

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let message = body;
    try {
      message = (JSON.parse(body) as { error?: string }).error ?? body;
    } catch {
      // Preserve the plain-text error returned by legacy endpoints.
    }
    throw new Error(message || "Video request failed. Please retry.");
  }
  return response.json() as Promise<T>;
}

type Draft = {
  file: File;
  preview: string;
  description: string;
  uploadId?: string;
  state: "waiting" | "uploading" | "ready" | "failed";
  progress: number;
};

export function useVideoDraft() {
  const [video, setVideo] = useState<Draft | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const current = useRef(video);
  current.current = video;
  const active = useRef<XMLHttpRequest | null>(null);
  const reservation = useRef<string | undefined>(undefined);
  const busy = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const refresh = () =>
      void json<{ videosEnabled: boolean }>("/api/newsfeed/config")
        .then((config) => {
          if (!alive.current) return;
          setEnabled(config.videosEnabled);
          if (!config.videosEnabled) {
            active.current?.abort();
            clear();
          }
        })
        .catch(() => {});
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => {
      clearInterval(timer);
      alive.current = false;
      active.current?.abort();
      if (current.current) URL.revokeObjectURL(current.current.preview);
    };
  }, []);

  function patch(values: Partial<Draft>) {
    if (alive.current) setVideo((item) => (item ? { ...item, ...values } : item));
  }

  useEffect(() => {
    if (!video || video.state !== "waiting" || busy.current) return;
    busy.current = true;
    patch({ state: "uploading" });
    void (async () => {
      let uploadId: string | undefined;
      try {
        const grant = await json<{ uploadId: string; url: string; token: string }>(
          "/api/newsfeed/uploads",
          { method: "POST", body: JSON.stringify({ kind: "video" }) },
        );
        uploadId = grant.uploadId;
        reservation.current = uploadId;
        if (!alive.current || !current.current) {
          if (alive.current)
            void json(`/api/newsfeed/uploads/${uploadId}`, { method: "DELETE" }).catch(() => {});
          return;
        }
        patch({ uploadId });
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          active.current = xhr;
          xhr.open("POST", grant.url);
          xhr.setRequestHeader("Authorization", `Bearer ${grant.token}`);
          xhr.upload.onprogress = (event) =>
            patch({
              progress: event.lengthComputable ? Math.round((event.loaded / event.total) * 100) : 0,
            });
          xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error(xhr.responseText)));
          xhr.onerror = () => reject(new Error("Video upload interrupted."));
          xhr.onabort = () => reject(new Error("Video upload cancelled."));
          xhr.send(video.file);
        });
        patch({ state: "ready", progress: 100 });
      } catch {
        const status = uploadId
          ? await json<{ state: string }>(`/api/newsfeed/uploads/${uploadId}`).catch(() => null)
          : null;
        patch({ state: status?.state === "ready" ? "ready" : "failed" });
      } finally {
        busy.current = false;
        active.current = null;
      }
    })();
  }, [video]);

  function select(files: FileList | null) {
    if (!files?.length) return;
    const file = files[0];
    if (files.length > 1) {
      setError("Choose one video per post.");
      return;
    }
    if (!file || file.size === 0 || file.size > MAX_VIDEO_BYTES || file.type !== "video/mp4") {
      setError(
        "Choose one MP4/H.264 video up to 60 seconds and 26,214,400 bytes. Convert MOV, HEVC, or WebM to MP4 first.",
      );
      return;
    }
    active.current?.abort();
    const oldUploadId = reservation.current ?? video?.uploadId;
    if (oldUploadId)
      void json(`/api/newsfeed/uploads/${oldUploadId}`, { method: "DELETE" }).catch(() => {});
    if (video) URL.revokeObjectURL(video.preview);
    reservation.current = undefined;
    setError("");
    setVideo({
      file,
      preview: URL.createObjectURL(file),
      description: "",
      state: "waiting",
      progress: 0,
    });
  }

  function remove() {
    active.current?.abort();
    const uploadId = reservation.current ?? current.current?.uploadId;
    if (uploadId)
      void json(`/api/newsfeed/uploads/${uploadId}`, { method: "DELETE" }).catch(() => {});
    if (current.current) URL.revokeObjectURL(current.current.preview);
    reservation.current = undefined;
    setVideo(null);
  }

  function retry() {
    const uploadId = reservation.current ?? current.current?.uploadId;
    if (uploadId)
      void json(`/api/newsfeed/uploads/${uploadId}`, { method: "DELETE" }).catch(() => {});
    patch({ uploadId: undefined, state: "waiting", progress: 0 });
  }

  function clear() {
    if (current.current) URL.revokeObjectURL(current.current.preview);
    reservation.current = undefined;
    setVideo(null);
  }

  return {
    video,
    enabled,
    error,
    select,
    remove,
    retry,
    patch,
    clear,
    valid: Boolean(
      video &&
      video.state === "ready" &&
      video.description.trim() &&
      Array.from(video.description.trim()).length <= 500,
    ),
  };
}

export function VideoControls({
  draft,
  disabled,
}: {
  draft: ReturnType<typeof useVideoDraft>;
  disabled: boolean;
}) {
  if (!draft.enabled) return null;
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend>Video (one per post, up to 60 seconds)</legend>
      <p className="text-xs text-muted-foreground">
        MP4/H.264 only, up to 26,214,400 bytes. Optional audio must be AAC-LC. Videos do not
        autoplay.
      </p>
      <label className="block">
        Choose video
        <input
          aria-label="Choose video"
          type="file"
          accept="video/mp4"
          onChange={(event) => {
            draft.select(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      <label className="block">
        Record video
        <input
          aria-label="Record video"
          type="file"
          accept="video/mp4"
          capture="environment"
          onChange={(event) => {
            draft.select(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {draft.error ? <p role="alert">{draft.error}</p> : null}
      {draft.video ? (
        <div className="rounded border p-3">
          <video
            src={draft.video.preview}
            controls
            playsInline
            preload="metadata"
            aria-label="Video preview"
            className="max-h-64 w-full rounded object-contain"
          />
          <label className="mt-3 block">
            Description for video
            <textarea
              required
              value={draft.video.description}
              onChange={(event) => draft.patch({ description: event.target.value })}
              className="block w-full border"
            />
          </label>
          <span role="status">
            {draft.video.state === "uploading"
              ? `Uploading ${draft.video.progress}%`
              : draft.video.state}
          </span>
          {draft.video.state === "uploading" ? (
            <progress value={draft.video.progress} max={100} aria-label="Video upload" />
          ) : null}
          {draft.video.state === "failed" ? (
            <button type="button" onClick={draft.retry}>
              Retry
            </button>
          ) : null}
          <button type="button" onClick={draft.remove}>
            Remove video
          </button>
        </div>
      ) : null}
    </fieldset>
  );
}

type Video = NonNullable<TNewsfeedPostDto["video"]>;

function ProtectedVideo({ video, moderation }: { video: Video; moderation: boolean }) {
  const [unavailable, setUnavailable] = useState(false);
  const element = useRef<HTMLVideoElement>(null);
  const source = `${moderation ? "/api/newsfeed/moderation/media" : "/api/newsfeed/media"}/${encodeURIComponent(video.mediaId)}`;

  useEffect(() => {
    let current = true;
    const checkAccess = () => {
      void fetch(source, { method: "HEAD", credentials: "same-origin", cache: "no-store" })
        .then((response) => {
          if (!current) return;
          if (!response.ok) {
            setUnavailable(true);
            if (element.current) {
              element.current.removeAttribute("src");
              element.current.load();
            }
          } else setUnavailable(false);
        })
        .catch(() => current && setUnavailable(true));
    };
    const timer = setInterval(checkAccess, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") checkAccess();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [source]);

  if (unavailable) return <p role="status">Video unavailable</p>;
  return (
    <video
      ref={element}
      src={source}
      controls
      playsInline
      preload="none"
      width={video.width}
      height={video.height}
      aria-label={video.description}
      onError={() => {
        setUnavailable(true);
        element.current?.removeAttribute("src");
        element.current?.load();
      }}
      className="max-h-[32rem] w-full rounded bg-black object-contain"
    />
  );
}

export function VideoGrid({
  post,
  moderation = false,
}: {
  post: TNewsfeedPostDto;
  moderation?: boolean;
}) {
  const { authSession } = useWallet();
  if (!post.video) return null;
  return (
    <div
      key={authSession?.address ?? "signed-out"}
      className="mt-3 overflow-hidden rounded bg-muted"
    >
      <ProtectedVideo video={post.video} moderation={moderation} />
      <p className="sr-only">{Math.round(post.video.duration)} second video</p>
    </div>
  );
}

export { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS };
