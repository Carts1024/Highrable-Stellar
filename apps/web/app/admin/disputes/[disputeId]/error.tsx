"use client";

import {
  AdminRouteErrorState,
  AdminRouteFallbackFrame,
} from "@/features/admin/admin-route-fallbacks";

export default function AdminDisputeDetailError({ reset }: { readonly reset: () => void }) {
  return (
    <AdminRouteFallbackFrame>
      <AdminRouteErrorState
        message="The dispute detail could not be rendered. Retry the route or return to the queue."
        reset={reset}
      />
    </AdminRouteFallbackFrame>
  );
}
