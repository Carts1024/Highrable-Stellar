"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

const MARQUEE_ITEMS = [
  "Highrable holds payment until the work is approved.",
  "Highrable holds payment until the work is approved.",
  "Highrable holds payment until the work is approved.",
  "Highrable holds payment until the work is approved.",
] as const;

type TScrollDirection = 1 | -1;

const REVEAL_EASE = [0.22, 1, 0.36, 1] as const;

const REVEAL_TAGS = {
  article: motion.article,
  div: motion.div,
  h1: motion.h1,
  h2: motion.h2,
  p: motion.p,
  span: motion.span,
} as const;

const COMPACT_VIEWPORT_QUERY = "(max-width: 639px)";
/** Reveal travel is reduced on phones so elements never swing far from their place. */
const COMPACT_TRAVEL_SCALE = 0.6;

function subscribeToCompactViewport(onChange: () => void) {
  const query = window.matchMedia(COMPACT_VIEWPORT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useIsCompactViewport() {
  return useSyncExternalStore(
    subscribeToCompactViewport,
    () => window.matchMedia(COMPACT_VIEWPORT_QUERY).matches,
    () => false,
  );
}

let scrollDirection: TScrollDirection = 1;
let lastScrollY = 0;
let scrollTrackerCount = 0;

function updateScrollDirection() {
  const currentScrollY = window.scrollY;

  if (currentScrollY === lastScrollY) {
    return;
  }

  scrollDirection = currentScrollY > lastScrollY ? 1 : -1;
  lastScrollY = currentScrollY;
}

/** Shares one passive scroll listener between every mounted reveal. */
function useScrollDirectionTracker() {
  useEffect(() => {
    if (scrollTrackerCount === 0) {
      lastScrollY = window.scrollY;
      window.addEventListener("scroll", updateScrollDirection, { passive: true });
    }
    scrollTrackerCount += 1;

    return () => {
      scrollTrackerCount -= 1;
      if (scrollTrackerCount === 0) {
        window.removeEventListener("scroll", updateScrollDirection);
      }
    };
  }, []);
}

type TV2RevealProps = {
  readonly children: ReactNode;
  readonly as?: keyof typeof REVEAL_TAGS;
  readonly className?: string;
  /** Seconds to wait before this element settles, used to stagger siblings. */
  readonly delay?: number;
  /** Vertical travel in px; flips with the scroll direction. */
  readonly y?: number;
  /** Horizontal travel in px from the element's resting position. */
  readonly x?: number;
  /** Starting scale; 1 disables the scale change. */
  readonly scale?: number;
  /** Lifts the element slightly on hover, once revealed. */
  readonly lift?: boolean;
  readonly ariaCurrent?: "step";
};

/**
 * Fades and settles an element into place each time it enters the viewport.
 * It enters moving with the scroll direction (up when scrolling down, down when
 * scrolling up) and resets on exit so it can replay. Transform and opacity only.
 */
export function V2Reveal({
  children,
  as = "div",
  className,
  delay = 0,
  y = 20,
  x = 0,
  scale = 1,
  lift = false,
  ariaCurrent,
}: TV2RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const isInView = useInView(ref, { amount: 0.3 });
  const isCompact = useIsCompactViewport();
  const travelScale = isCompact ? COMPACT_TRAVEL_SCALE : 1;
  const [wasInView, setWasInView] = useState(false);
  const [exitSign, setExitSign] = useState<TScrollDirection>(1);
  useScrollDirectionTracker();

  // Leaving the top edge (scrolling down) means the element re-enters from above.
  if (isInView !== wasInView) {
    setWasInView(isInView);
    if (!isInView) {
      setExitSign(scrollDirection === 1 ? -1 : 1);
    }
  }

  const Tag = REVEAL_TAGS[as] as typeof motion.div;
  const startX = x * travelScale;
  const startY = y * travelScale;
  const visible = { opacity: 1, x: 0, y: 0, scale: 1 };

  let animate;
  if (shouldReduceMotion) {
    animate = { ...visible, transition: { duration: 0 } };
  } else if (isInView) {
    animate = { ...visible, transition: { duration: 0.6, ease: REVEAL_EASE, delay } };
  } else {
    animate = {
      opacity: 0,
      x: startX,
      y: exitSign * startY,
      scale,
      transition: { duration: 0.3, ease: "easeIn" as const },
    };
  }

  return (
    <Tag
      ref={ref}
      initial={{ opacity: 0, x: startX, y: startY, scale }}
      animate={animate}
      whileHover={lift && !shouldReduceMotion ? { y: -4 } : undefined}
      aria-current={ariaCurrent}
      className={className}
    >
      {children}
    </Tag>
  );
}

export function V2AnnouncementMarquee() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      role="img"
      aria-label={MARQUEE_ITEMS[0]}
      className="overflow-hidden bg-linear-to-r from-[#FF8703] to-[#FE6002] py-3 sm:py-3.5"
    >
      <motion.div
        aria-hidden="true"
        className="flex w-max"
        animate={shouldReduceMotion ? undefined : { x: ["0%", "-50%"] }}
        transition={
          shouldReduceMotion ? undefined : { duration: 55, ease: "linear", repeat: Infinity }
        }
      >
        {[0, 1].map((group) => (
          <div
            key={group}
            className="flex shrink-0 items-center gap-9 pr-9 font-sans text-base font-semibold text-white sm:text-lg"
          >
            {MARQUEE_ITEMS.map((item, index) => (
              <span key={`${group}-${index}`} className="flex shrink-0 items-center gap-9">
                {item}
                <span aria-hidden="true">·</span>
              </span>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
