import { PageHeader } from "@/components/app/page-header";
import { CampaignForm } from "@/components/intent/campaign-form";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "New Intent Campaign" };

export default async function NewIntentCampaignPage() {
  await requireSession();
  return (
    <>
      <PageHeader
        title="New Intent Campaign"
        description="Define who counts as a buying signal for this vertical — everything below is editable later."
      />
      <CampaignForm />
    </>
  );
}
