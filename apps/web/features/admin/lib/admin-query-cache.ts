import { ADMIN_QUERY_KEY } from "@/features/admin/admin-session-gate";

import type { QueryClient } from "@tanstack/react-query";

export async function invalidateAdminDisputeCaches(
  queryClient: QueryClient,
  verifiedWallet: string,
  disputeId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: [...ADMIN_QUERY_KEY, "disputes", verifiedWallet],
      refetchType: "none",
    }),
    queryClient.invalidateQueries({
      queryKey: [...ADMIN_QUERY_KEY, "dispute", verifiedWallet, disputeId],
      refetchType: "none",
    }),
  ]);
}
