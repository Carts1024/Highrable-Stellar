import { RouteCallout } from "@/features/common";
import React, { type ReactNode } from "react";

export function AdminRouteLoadingState({ label }: { readonly label: string }) {
  return <RouteCallout>Loading {label}...</RouteCallout>;
}

export function AdminRouteErrorState({
  message,
  reset,
}: {
  readonly message: string;
  readonly reset: () => void;
}) {
  return (
    <RouteCallout tone="danger">
      <span>{message}</span>
      <button
        type="button"
        className="ml-3 underline"
        onClick={reset}
        aria-label="Retry admin route"
      >
        Retry
      </button>
    </RouteCallout>
  );
}

export function AdminRouteFallbackFrame({ children }: { readonly children: ReactNode }) {
  return <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>;
}
