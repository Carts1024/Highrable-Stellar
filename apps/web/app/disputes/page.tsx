import { DisputeList } from "@/features/disputes";

export default function DisputesPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <p className="font-mono text-xs text-[#5f5f5f] uppercase">Highrable Review Flow</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#0a0a0a]">Disputes</h1>
        <p className="mt-2 text-sm text-[#5f5f5f]">
          Platform-reviewed dispute records, evidence, and on-chain dispute status.
        </p>
      </div>
      <DisputeList />
    </main>
  );
}
