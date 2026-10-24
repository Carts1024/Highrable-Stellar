import { buildNoIndexMetadata } from "@/core/seo";
import { AdminAdminsPage } from "@/features/admin";

import type { Metadata } from "next";

export const metadata: Metadata = buildNoIndexMetadata(
  "Dispute Admin Team",
  "Owner-managed dispute administrator access for Highrable.",
  "/admin/admins",
);

export default function AdminAdminsRoutePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <AdminAdminsPage />
    </div>
  );
}
