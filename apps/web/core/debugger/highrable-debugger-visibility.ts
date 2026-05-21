import { env } from "@/core/config/env";

/** Returns whether the internal Highrable debugger should render in the current runtime. */
export function isHighrableDebuggerEnabled(): boolean {
  if (typeof env.NEXT_PUBLIC_ENABLE_HIGHRABLE_DEBUGGER === "boolean") {
    return env.NEXT_PUBLIC_ENABLE_HIGHRABLE_DEBUGGER;
  }

  return env.NODE_ENV === "development";
}
