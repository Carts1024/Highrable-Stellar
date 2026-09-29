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
    <main className="mx-auto max-w-6xl px-4 py-10">
      <AdminAdminsPage />
    </main>
  );
}
