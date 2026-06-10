import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import {
  V2_PAGE_CONTAINER_CLASS,
  V2_SECTION_SPACING_CLASS,
} from "@repo/ui/components/highrable/v2-theme";
import { ShieldCheck, Zap, Star } from "lucide-react";
import { z } from "zod";

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
  { icon: ShieldCheck, label: "Payment held safely until work is done" },
  { icon: Zap, label: "Paid in seconds, not days" },
  { icon: Star, label: "Reviews you can't fake or delete" },
] as const;

const DEMO_VIDEO_CONFIG = {
  videoId: TYouTubeVideoIdSchema.parse("ynltz9yOkVU"),
  title: "Highrable platform demo",
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

/** Static decorative background — no animation, no invalid SVG attributes */
function DemoBackground() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* Large hollow ring — bleeds off top-left */}
      <circle cx="-40" cy="80" r="160" fill="none" stroke="rgba(255,112,3,0.13)" strokeWidth="36" />
      {/* Medium hollow ring — bleeds off bottom-right, fixed px coords */}
      <circle
        cx="1480"
        cy="560"
        r="120"
        fill="none"
        stroke="rgba(255,112,3,0.10)"
        strokeWidth="26"
      />
      {/* Concentric accent circles — top right */}
      <circle cx="1320" cy="70" r="48" fill="rgba(255,136,1,0.07)" />
      <circle cx="1320" cy="70" r="26" fill="rgba(255,136,1,0.09)" />
      {/* Small scattered dots — bottom left */}
      <circle cx="120" cy="480" r="5" fill="rgba(255,112,3,0.16)" />
      <circle cx="148" cy="456" r="3" fill="rgba(255,112,3,0.11)" />
      {/* Small scattered dots — top right cluster */}
      <circle cx="1260" cy="38" r="4" fill="rgba(255,136,1,0.14)" />
      <circle cx="1284" cy="22" r="2.5" fill="rgba(255,136,1,0.10)" />
      {/* Bottom centre dot */}
      <circle cx="760" cy="560" r="4" fill="rgba(255,112,3,0.10)" />
    </svg>
  );
}

export function V2DemoVideoSection() {
  return (
    <section
      id="demo"
      className={`relative overflow-hidden bg-orange-50 ${V2_SECTION_SPACING_CLASS}`}
    >
      <DemoBackground />

      <div className={`${V2_PAGE_CONTAINER_CLASS} relative z-10`}>
        <div className="mb-10 max-w-2xl text-left">
          <SectionLabel className="mb-4">See It In Action</SectionLabel>
          <h2 className="hr-text-primary text-3xl leading-[1.15] font-medium md:text-4xl">
            Watch how it works in under 3 minutes
          </h2>
          <p className="hr-text-secondary mt-4 text-base leading-relaxed">
            See how a freelancer and client agree on a project, lock payment securely, and get paid
            the moment the work is approved — no chasing invoices, no disputes.
          </p>
        </div>

        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-orange-200 shadow-xl shadow-orange-900/10">
          <div className="relative aspect-video w-full bg-neutral-950">
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
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
          {HIGHLIGHT_PILLS.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 shadow-sm"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-orange-500" />
              <span className="text-xs font-medium text-neutral-700">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
