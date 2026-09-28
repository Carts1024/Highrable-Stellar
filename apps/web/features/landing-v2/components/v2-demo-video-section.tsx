import { ShieldCheck, Zap, Star } from "lucide-react";
import { z } from "zod";

import {
  EDITORIAL_CONTAINER_CLASS,
  EDITORIAL_SECTION_CLASS,
  EditorialSectionLabel,
} from "./editorial-layout";
import { V2Reveal } from "./v2-animated-elements";

type TYouTubeEmbedConfig = {
  readonly videoId: string;
  readonly title: string;
  readonly durationLabel: string;
};

const TYouTubeVideoIdSchema = z
  .string()
  .trim()
  .regex(/^[\w-]{11}$/, "Invalid YouTube video ID.");

const HIGHLIGHT_PILLS = [
  { icon: ShieldCheck, label: "Payment held until work is done" },
  { icon: Zap, label: "Paid quickly, not slowly" },
  { icon: Star, label: "Reviews tied to real jobs" },
] as const;

const DEMO_VIDEO_CONFIG = {
  videoId: TYouTubeVideoIdSchema.parse("ynltz9yOkVU"),
  title: "How Highrable works",
  durationLabel: "~3 min",
} as const satisfies TYouTubeEmbedConfig;

function createYouTubeEmbedUrl(videoId: string): string {
  const sanitizedVideoId = TYouTubeVideoIdSchema.parse(videoId);
  const query = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    modestbranding: "1",
  });

  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(sanitizedVideoId)}?${query.toString()}`;
}

function createYouTubeThumbnailUrl(videoId: string): string {
  const sanitizedVideoId = TYouTubeVideoIdSchema.parse(videoId);
  return `https://img.youtube.com/vi/${encodeURIComponent(sanitizedVideoId)}/maxresdefault.jpg`;
}

function escapeHtmlAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function createYouTubeSrcDoc(config: TYouTubeEmbedConfig): string {
  const embedUrl = createYouTubeEmbedUrl(config.videoId);
  const thumbnailUrl = createYouTubeThumbnailUrl(config.videoId);
  const title = escapeHtmlAttribute(config.title);

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:#0a0a0a}a{display:flex;position:absolute;inset:0;align-items:center;justify-content:center;overflow:hidden;color:#fff;text-decoration:none}img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.5}.shade{position:absolute;inset:0;background:linear-gradient(to top,rgba(10,10,10,.8),rgba(10,10,10,.18),transparent)}.button{position:relative;display:grid;width:96px;height:96px;place-items:center;border:2px solid rgba(255,255,255,.3);border-radius:999px;background:rgba(249,115,22,.92);box-shadow:0 24px 60px rgba(0,0,0,.4)}.button:before{content:"";position:absolute;inset:0;border-radius:inherit;background:rgba(249,115,22,.28);animation:pulse 1.5s cubic-bezier(0,0,.2,1) infinite}.triangle{position:relative;width:0;height:0;margin-left:7px;border-top:18px solid transparent;border-bottom:18px solid transparent;border-left:28px solid #fff}@keyframes pulse{75%,100%{transform:scale(1.8);opacity:0}}@media(max-width:640px){.button{width:80px;height:80px}.triangle{border-top-width:15px;border-bottom-width:15px;border-left-width:24px}}</style></head><body><a href="${embedUrl}" aria-label="Play ${title}"><img src="${thumbnailUrl}" alt="${title} thumbnail"><span class="shade"></span><span class="button"><span class="triangle"></span></span></a></body></html>`;
}

export function V2DemoVideoSection() {
  return (
    <section id="demo" className={`${EDITORIAL_SECTION_CLASS} text-center`}>
      <div className={`${EDITORIAL_CONTAINER_CLASS} relative z-10`}>
        <div className="mx-auto mb-8 max-w-2xl">
          <EditorialSectionLabel>See it in action</EditorialSectionLabel>
          <V2Reveal
            as="h2"
            delay={0.08}
            className="hr-text-primary text-3xl leading-[1.08] font-bold tracking-tight md:text-5xl"
          >
            Watch how it works in under 3 minutes.
          </V2Reveal>
          <V2Reveal
            as="p"
            delay={0.16}
            className="hr-text-secondary mx-auto mt-4 max-w-xl text-base leading-relaxed"
          >
            See how work moves from agreement to approval, with payment ready at every step.
          </V2Reveal>
        </div>

        <V2Reveal
          delay={0.24}
          y={24}
          scale={0.97}
          className="relative mx-auto max-w-[clamp(28rem,calc((100svh_-_31rem)*16/9),56rem)] overflow-hidden rounded-xl border border-border bg-[#0A0A0A] shadow-[0_20px_55px_rgba(0,0,0,0.3)]"
        >
          <div className="relative aspect-video w-full">
            <iframe
              className="absolute inset-0 h-full w-full"
              src={createYouTubeEmbedUrl(DEMO_VIDEO_CONFIG.videoId)}
              srcDoc={createYouTubeSrcDoc(DEMO_VIDEO_CONFIG)}
              title={DEMO_VIDEO_CONFIG.title}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
            <p className="pointer-events-none absolute right-5 bottom-5 z-10 rounded-md bg-black/60 px-2.5 py-1 font-mono text-[0.65rem] text-white/70">
              {DEMO_VIDEO_CONFIG.durationLabel}
            </p>
          </div>
        </V2Reveal>

        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          {HIGHLIGHT_PILLS.map(({ icon: Icon, label }, index) => (
            <V2Reveal
              key={label}
              y={12}
              delay={0.32 + index * 0.08}
              className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2"
            >
              <Icon className="hr-text-accent h-3.5 w-3.5 shrink-0" />
              <span className="hr-text-secondary text-xs font-medium">{label}</span>
            </V2Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
