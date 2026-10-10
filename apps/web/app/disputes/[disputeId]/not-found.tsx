import { RouteCallout } from "@/features/common";
import Link from "next/link";

export default function DisputeNotFound() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <RouteCallout tone="warning" role="alert">
        Dispute not found.{" "}
        <Link href="/disputes" className="underline">
          View all disputes
        </Link>
      </RouteCallout>
    </main>
  );
}
