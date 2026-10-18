import { ProductPageHero } from "@/features/common";
import { DisputeList } from "@/features/disputes";

export default function DisputesPage() {
  return (
    <div className="space-y-8">
      <ProductPageHero
        label="Help & problems"
        title={
          <>
            Your <span className="hr-mode-text">disputes</span>
          </>
        }
        description="If a job goes wrong, a Highrable reviewer can look at the evidence from both sides. Cases you are part of are listed here."
      />
      <DisputeList />
    </div>
  );
}
