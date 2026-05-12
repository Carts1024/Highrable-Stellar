export const V2_THEME = {
  colors: {
    textPrimary: "text-[#0a0a0a]",
    textSecondary: "text-[#5f5f5f]",
    textMuted: "text-[#7f7f7f]",
    accentText: "text-[#B94A00]",
    border: "border-[#e8e8e8]",
    surfaceMuted: "bg-[#f5f5f5]",
    surfaceAccent: "bg-[#fff7ed]",
  },
  gradients: {
    primary: "bg-linear-to-r from-[#FF8801] via-[#FF7003] to-[#E85D00]",
    primaryStrong: "bg-linear-to-r from-[#FF7003] to-[#FF8801]",
  },
  effects: {
    hardShadow: "shadow-[5.67px_5.67px_0px_rgba(0,0,0,0.08)]",
    hardShadowStrong: "shadow-[5.67px_5.67px_0px_rgba(0,0,0,0.2)]",
  },
} as const;

export const V2_PAGE_CONTAINER_CLASS = "mx-auto max-w-7xl px-6";
export const V2_SECTION_SPACING_CLASS = "py-16 md:py-20";
