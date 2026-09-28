"use client";

import { useEffect } from "react";

const SNAP_OVERFLOW_ATTRIBUTE = "data-snap-overflow";
const SECTION_SELECTOR = ".landing-v2-page > main > section";

/**
 * Keeps section snapping accessible: while every section fits the viewport the
 * page uses mandatory snapping; as soon as one is taller (short laptops, phones,
 * large text) it flags <html> so CSS relaxes snapping and the whole section can
 * be scrolled through instead of being skipped.
 */
export function V2SnapGuard() {
  useEffect(() => {
    const root = document.documentElement;
    const sections = Array.from(document.querySelectorAll<HTMLElement>(SECTION_SELECTOR));

    const update = () => {
      const hasOverflow = sections.some((section) => section.offsetHeight > window.innerHeight + 1);
      root.toggleAttribute(SNAP_OVERFLOW_ATTRIBUTE, hasOverflow);
    };

    const observer = new ResizeObserver(update);
    sections.forEach((section) => observer.observe(section));
    window.addEventListener("resize", update);
    update();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      root.removeAttribute(SNAP_OVERFLOW_ATTRIBUTE);
    };
  }, []);

  return null;
}
