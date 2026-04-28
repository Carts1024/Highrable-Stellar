export const APP_NAME = "TaskFlow" as const;

export const EMAIL_FONTS = {
  sans: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`,
  mono: `'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace`,
} as const;

// Hex equivalents of the UI's dark theme globals.css oklch values.
// All email clients require hex — no CSS variables, no oklch.
export const EMAIL_COLORS = {
  page: {
    bg: "#0a0a0a",
  },
  card: {
    bg: "#111111",
    bgMuted: "#1c1c1c",
    border: "#2a2a2a",
    borderSubtle: "#1f1f1f",
  },
  text: {
    primary: "#f5f5f5",
    secondary: "#a3a3a3",
    dimmed: "#737373",
  },
  brand: {
    primary: "#3b82f6",
  },
  role: {
    admin: "#818cf8",
    member: "#a3a3a3",
  },
  semantic: {
    dangerFg: "#f87171",
    dangerBg: "rgba(239, 68, 68, 0.06)",
    dangerBorder: "rgba(239, 68, 68, 0.18)",
  },
} as const;

export const EMAIL_RADIUS = {
  sm: "6px",
  md: "10px",
  lg: "16px",
  xl: "20px",
} as const;
