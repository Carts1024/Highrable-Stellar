import {
  AdminRouteFallbackFrame,
  AdminRouteLoadingState,
} from "@/features/admin/admin-route-fallbacks";

export default function AdminDisputesLoading() {
  return (
    <AdminRouteFallbackFrame>
      <AdminRouteLoadingState label="dispute queue" />
    </AdminRouteFallbackFrame>
  );
}
