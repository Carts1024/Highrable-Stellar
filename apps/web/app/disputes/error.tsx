"use client";

import { RouteCallout } from "@/features/common";
import React from "react";

export default function DisputesError({ reset }: { readonly reset: () => void }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <RouteCallout tone="danger" role="alert">
        <span>Unable to load disputes. Please try again.</span>
        <button type="button" className="ml-3 underline" onClick={reset}>
          Retry
        </button>
      </RouteCallout>
    </main>
  );
}
