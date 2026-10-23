import { ProductPageHero } from "@/features/common";
import { DisputeList } from "@/features/disputes";

export default function DisputesPage() {
  return (
    <div className="space-y-6">
      <ProductPageHero
        title="Disputes"
        description="Cases you are part of. A Highrable reviewer looks at the evidence from both sides before deciding."
      />
      <DisputeList />
    </div>
  );
}
