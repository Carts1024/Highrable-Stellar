import React from "react";

/** Admin identity mark: a short bar in the admin orange-to-yellow gradient beside a plain label. */
export function AdminMark() {
  return (
    <span className="inline-flex items-center gap-1.5 font-sans">
      <span className="h-1.5 w-4 rounded-full bg-(image:--mode-gradient)" aria-hidden="true" />
      Highrable Admin
    </span>
  );
}
