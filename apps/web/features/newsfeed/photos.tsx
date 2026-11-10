"use client";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { useEffect, useRef, useState } from "react";

import type { TNewsfeedPostDto } from "@repo/convex-client";
async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) throw new Error("Photo request failed. Please retry.");
  return response.json() as Promise<T>;
}
type Draft = {
  key: string;
  file: File;
  preview: string;
  description: string;
  uploadId?: string;
  state: "waiting" | "uploading" | "ready" | "failed";
  progress: number;
};
export function usePhotoDraft() {
  const [photos, setPhotos] = useState<Draft[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const current = useRef(photos);
  current.current = photos;
  const active = useRef<XMLHttpRequest | null>(null);
  const reservations = useRef(new Map<string, string>());
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const refresh = () =>
      void json<{ photosEnabled: boolean }>("/api/newsfeed/config")
        .then((c) => {
          if (!alive.current) return;
          setEnabled(c.photosEnabled);
          if (!c.photosEnabled) {
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
      for (const photo of current.current) URL.revokeObjectURL(photo.preview);
    };
  }, []);
  function patch(key: string, values: Partial<Draft>) {
    if (alive.current)
      setPhotos((items) => items.map((p) => (p.key === key ? { ...p, ...values } : p)));
  }
  // One transfer at a time. A failed transfer requires an explicit retry.
  useEffect(() => {
    const photo = photos.find((p) => p.state === "waiting");
    if (!photo || busy.current) return;
    busy.current = true;
    patch(photo.key, { state: "uploading" });
    void (async () => {
      let uploadId: string | undefined;
      try {
        const grant = await json<{ uploadId: string; url: string; token: string }>(
          "/api/newsfeed/uploads",
          { method: "POST" },
        );
        uploadId = grant.uploadId;
        reservations.current.set(photo.key, uploadId);
        if (!alive.current || !current.current.some((p) => p.key === photo.key)) {
          if (alive.current)
            void json(`/api/newsfeed/uploads/${uploadId}`, { method: "DELETE" }).catch(() => {});
          return;
        }
        patch(photo.key, { uploadId });
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          active.current = xhr;
          xhr.open("POST", grant.url);
          xhr.setRequestHeader("Authorization", `Bearer ${grant.token}`);
          xhr.upload.onprogress = (e) =>
            patch(photo.key, {
              progress: e.lengthComputable ? Math.round((e.loaded / e.total) * 100) : 0,
            });
          xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error(xhr.responseText)));
          xhr.onerror = () => reject(new Error("Upload interrupted."));
          xhr.onabort = () => reject(new Error("Upload cancelled."));
          xhr.send(photo.file);
        });
        patch(photo.key, { state: "ready", progress: 100 });
      } catch {
        // A lost transfer response may still have finalized. Preserve that upload.
        const status = uploadId
          ? await json<{ state: string }>(`/api/newsfeed/uploads/${uploadId}`).catch(() => null)
          : null;
        patch(photo.key, { state: status?.state === "ready" ? "ready" : "failed" });
      } finally {
        busy.current = false;
        active.current = null;
        if (alive.current) setPhotos((items) => [...items]);
      }
    })();
  }, [photos]);
  function remove(key: string) {
    const photo = current.current.find((p) => p.key === key);
    if (!photo) return;
    if (photo.state === "uploading") active.current?.abort();
    const uploadId = reservations.current.get(key) ?? photo.uploadId;
    if (uploadId)
      void json(`/api/newsfeed/uploads/${uploadId}`, { method: "DELETE" }).catch(() => {});
    reservations.current.delete(key);
    URL.revokeObjectURL(photo.preview);
    setPhotos((items) => items.filter((p) => p.key !== key));
  }
  function select(files: FileList | null) {
    if (!files?.length) return;
    const chosen = Array.from(files);
    if (photos.length + chosen.length > 4) {
      setError("Choose up to four photos.");
      return;
    }
    if (
      chosen.some(
        (f) =>
          !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
          f.size === 0 ||
          f.size > 10 * 1024 * 1024,
      )
    ) {
      setError(
        "Choose JPEG, PNG, or WebP files up to 10 MB. Export HEIC/HEIF photos as JPEG first.",
      );
      return;
    }
    setError("");
    setPhotos((items) => [
      ...items,
      ...chosen.map((file) => ({
        key: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        description: "",
        state: "waiting" as const,
        progress: 0,
      })),
    ]);
  }
  function clear() {
    for (const photo of current.current) URL.revokeObjectURL(photo.preview);
    setPhotos([]);
  }
  function retry(photo: Draft) {
    if (photo.uploadId)
      void json(`/api/newsfeed/uploads/${photo.uploadId}`, { method: "DELETE" }).catch(() => {});
    patch(photo.key, { uploadId: undefined, state: "waiting", progress: 0 });
  }
  return {
    photos,
    enabled,
    error,
    select,
    remove,
    retry,
    patch,
    clear,
    valid: photos.every(
      (p) =>
        p.state === "ready" &&
        !!p.description.trim() &&
        Array.from(p.description.trim()).length <= 500,
    ),
  };
}
export function PhotoControls({
  draft,
  disabled,
}: {
  draft: ReturnType<typeof usePhotoDraft>;
  disabled: boolean;
}) {
  if (!draft.enabled) return null;
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend>Photos (up to four)</legend>
      <label className="block">
        Choose photos
        <input
          aria-label="Choose photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => {
            draft.select(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <label className="block">
        Take photo
        <input
          aria-label="Take photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(e) => {
            draft.select(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {draft.error && <p role="alert">{draft.error}</p>}
      {draft.photos.map((p, i) => (
        <div key={p.key} className="rounded border p-3">
          <img src={p.preview} alt={`Draft ${i + 1}`} className="h-32 w-32 object-contain" />
          <label>
            Description for photo {i + 1}
            <textarea
              required
              value={p.description}
              onChange={(e) => draft.patch(p.key, { description: e.target.value })}
              className="block w-full border"
            />
          </label>
          <span role="status">
            {p.state === "uploading" ? `Uploading ${p.progress}%` : p.state}
          </span>
          {p.state === "uploading" && (
            <progress value={p.progress} max={100} aria-label={`Photo ${i + 1} upload`} />
          )}
          {p.state === "failed" && (
            <button type="button" onClick={() => draft.retry(p)}>
              Retry
            </button>
          )}
          <button type="button" onClick={() => draft.remove(p.key)}>
            Remove photo {i + 1}
          </button>
        </div>
      ))}
    </fieldset>
  );
}
type Photo = NonNullable<TNewsfeedPostDto["photos"]>[number];
function ProtectedPhoto({ photo, moderation }: { photo: Photo; moderation: boolean }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState(false);
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let objectUrl = "";
    let current = true;
    let loading = false;
    const controller = new AbortController();
    async function load() {
      if (loading) return;
      loading = true;
      try {
        const grant = await json<{ url: string; token: string }>(
          moderation ? "/api/newsfeed/moderation/media" : "/api/newsfeed/media",
          {
            method: "POST",
            body: JSON.stringify({ mediaId: photo.mediaId }),
            signal: controller.signal,
          },
        );
        if (objectUrl) return;
        const response = await fetch(grant.url, {
          headers: { Authorization: `Bearer ${grant.token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Unavailable");
        const blob = await response.blob();
        if (current) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
          setError(false);
        }
      } catch {
        if (current) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = "";
          setSrc("");
          setError(true);
        }
      } finally {
        loading = false;
      }
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void load();
    });
    if (element.current) observer.observe(element.current);
    // Reauthorize visible content to discard revoked access without navigating away.
    const timer = setInterval(() => {
      if (element.current && element.current.getBoundingClientRect().top < window.innerHeight)
        void load();
    }, 30_000);
    return () => {
      current = false;
      controller.abort();
      observer.disconnect();
      clearInterval(timer);
      URL.revokeObjectURL(objectUrl);
    };
  }, [photo.mediaId, moderation]);
  return (
    <div
      ref={element}
      style={{ aspectRatio: `${photo.width}/${photo.height}` }}
      className="overflow-hidden rounded bg-muted"
    >
      {src ? (
        <img
          src={src}
          alt={photo.description}
          width={photo.width}
          height={photo.height}
          loading="lazy"
          className="h-full w-full object-contain"
          onError={() => {
            setError(true);
            setSrc("");
          }}
        />
      ) : (
        <p role="status">{error ? "Photo unavailable" : "Loading photo…"}</p>
      )}
    </div>
  );
}
export function PhotoGrid({
  post,
  moderation = false,
}: {
  post: TNewsfeedPostDto;
  moderation?: boolean;
}) {
  const { authSession } = useWallet();
  return (
    <div
      key={authSession?.address ?? "signed-out"}
      className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
      {post.photos?.map((photo) => (
        <ProtectedPhoto key={photo.mediaId} photo={photo} moderation={moderation} />
      ))}
    </div>
  );
}
