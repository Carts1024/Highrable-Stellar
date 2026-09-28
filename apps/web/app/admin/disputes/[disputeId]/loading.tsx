import {
  AdminRouteFallbackFrame,
  AdminRouteLoadingState,
} from "@/features/admin/admin-route-fallbacks";

export default function AdminDisputeDetailLoading() {
  return (
    <AdminRouteFallbackFrame>
      <AdminRouteLoadingState label="dispute detail" />
    </AdminRouteFallbackFrame>
  );
}
