export function sanitizeSingleLineInput(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function sanitizeMultilineInput(value: string): string {
  return value.replace(/\r/g, "").trim();
}
