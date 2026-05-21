import { buildNoIndexMetadata } from "@/core/seo";
import { AdminDashboardPage } from "@/features/admin";

import type { Metadata } from "next";

export const metadata: Metadata = buildNoIndexMetadata(
  "Highrable Admin Dashboard",
  "Platform operations dashboard for configured Highrable admin wallet.",
  "/admin",
);

export default function AdminHomeRoutePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <AdminDashboardPage />
    </main>
  );
}
