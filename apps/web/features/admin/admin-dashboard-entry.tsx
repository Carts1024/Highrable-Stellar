"use client";

import { AdminDashboardContent } from "@/features/admin/admin-dashboard-page";
import { AdminSessionGate, useAdminSessionAccess } from "@/features/admin/admin-session-gate";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";

function AdminDashboardEntryContent() {
  const { isOwner } = useAdminSessionAccess();
  const router = useRouter();

  useEffect(() => {
    if (!isOwner) {
      router.replace("/admin/disputes");
    }
  }, [isOwner, router]);

  if (!isOwner) {
    return null;
  }

  return <AdminDashboardContent />;
}

/** Routes verified dashboard admins to the capability-appropriate admin surface. */
export function AdminDashboardEntry() {
  return (
    <AdminSessionGate requiredCapability="dispute">
      <AdminDashboardEntryContent />
    </AdminSessionGate>
  );
}
