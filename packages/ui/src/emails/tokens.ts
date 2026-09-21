export const APP_NAME = "Highrable" as const;

export const EMAIL_FONTS = {
  sans: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`,
  mono: `'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace`,
} as const;

// Hex equivalents of the landing-v2 Highrable tokens.
// Email clients require inline-safe values, not CSS variables or oklch.
export const EMAIL_COLORS = {
  page: {
    bg: "#f5f5f5",
    grid: "#ececec",
  },
  card: {
    bg: "#ffffff",
    bgInverse: "#0a0a0a",
    bgMuted: "#fafafa",
    bgAccent: "#fff7ed",
    border: "#e8e8e8",
    borderStrong: "#0a0a0a",
    borderAccent: "#ffd8ba",
    borderSubtle: "#f0f0f0",
  },
  text: {
    primary: "#0a0a0a",
    inverse: "#ffffff",
    secondary: "#5f5f5f",
    muted: "#7f7f7f",
    dimmed: "#a3a3a3",
  },
  brand: {
    orange1: "#ff8801",
    orange2: "#ff7003",
    orange3: "#e85d00",
    orange4: "#b94a00",
    accentBg: "#fff7ed",
    accentText: "#b94a00",
    amber: "#f59e0b",
    stellar: "#4f46e5",
    success: "#059669",
  },
} as const;

export const EMAIL_RADIUS = {
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "18px",
} as const;

export const EMAIL_SOCIAL_LINKS = [
  { label: "X/Twitter", href: "https://x.com/highrable" },
  { label: "Facebook", href: "https://web.facebook.com/Highrable" },
  { label: "Instagram", href: "https://www.instagram.com/highrable.work/" },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/highrable/" },
] as const;
