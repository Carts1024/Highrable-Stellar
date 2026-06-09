"use client";

import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import {
  V2_PAGE_CONTAINER_CLASS,
  V2_SECTION_SPACING_CLASS,
} from "@repo/ui/components/highrable/v2-theme";
import { motion } from "framer-motion";
import { PlayCircle, ShieldCheck, Zap, Star } from "lucide-react";
import { useState } from "react";

const HIGHLIGHT_PILLS = [
  { icon: ShieldCheck, label: "Payment held safely until work is done" },
  { icon: Zap, label: "Paid in seconds, not days" },
  { icon: Star, label: "Reviews you can't fake or delete" },
];

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
  const [hasStarted, setHasStarted] = useState(false);

  return (
    <section
      id="demo"
      className={`relative overflow-hidden bg-orange-50 ${V2_SECTION_SPACING_CLASS}`}
    >
      <DemoBackground />

      <div className={`${V2_PAGE_CONTAINER_CLASS} relative z-10`}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-10 max-w-2xl text-left"
        >
          <SectionLabel className="mb-4">See It In Action</SectionLabel>
          <h2 className="hr-text-primary text-3xl leading-[1.15] font-medium md:text-4xl">
            Watch how it works in under 3 minutes
          </h2>
          <p className="hr-text-secondary mt-4 text-base leading-relaxed">
            See how a freelancer and client agree on a project, lock payment securely, and get paid
            the moment the work is approved — no chasing invoices, no disputes.
          </p>
        </motion.div>

        {/* Video embed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-orange-200 shadow-xl shadow-orange-900/10"
        >
          {/* 16:9 aspect ratio wrapper */}
          <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
            {!hasStarted ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950">
                <img
                  src="https://img.youtube.com/vi/ynltz9yOkVU/maxresdefault.jpg"
                  alt="Highrable platform demo video thumbnail"
                  className="absolute inset-0 h-full w-full object-cover opacity-50"
                />
                <div className="absolute inset-0 bg-linear-to-t from-neutral-950/80 via-neutral-950/20 to-transparent" />

                {/* Play button — pulse via CSS animation, not framer-motion, to avoid rerender cost */}
                <button
                  onClick={() => setHasStarted(true)}
                  className="relative z-10 flex flex-col items-center gap-4 focus:outline-none"
                  aria-label="Play demo video"
                >
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/30 bg-orange-500/90 shadow-2xl backdrop-blur-sm transition-transform duration-200 hover:scale-105 active:scale-95 sm:h-24 sm:w-24">
                    <span className="absolute inset-0 animate-ping rounded-full bg-orange-500/30" />
                    <PlayCircle className="relative h-10 w-10 text-white sm:h-12 sm:w-12" />
                  </div>
                  <span className="font-mono text-xs font-bold tracking-widest text-white/90 uppercase">
                    Watch Demo
                  </span>
                </button>

                <p className="absolute right-5 bottom-5 z-10 rounded-md bg-black/60 px-2.5 py-1 font-mono text-[0.65rem] text-white/70">
                  ~3 min
                </p>
              </div>
            ) : (
              <iframe
                className="absolute inset-0 h-full w-full"
                src="https://www.youtube.com/embed/ynltz9yOkVU?autoplay=1&rel=0&modestbranding=1"
                title="Highrable platform demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
        </motion.div>

        {/* Highlight pills */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start"
        >
          {HIGHLIGHT_PILLS.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 shadow-sm"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-orange-500" />
              <span className="text-xs font-medium text-neutral-700">{label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
