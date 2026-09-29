"use client";

import {
  AdminRouteErrorState,
  AdminRouteFallbackFrame,
} from "@/features/admin/admin-route-fallbacks";

export default function AdminDisputesError({ reset }: { readonly reset: () => void }) {
  return (
    <AdminRouteFallbackFrame>
      <AdminRouteErrorState
        message="The dispute queue could not be rendered. Retry the route or return later."
        reset={reset}
      />
    </AdminRouteFallbackFrame>
  );
}
