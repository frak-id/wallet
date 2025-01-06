import { CampaignDetails } from "@/module/campaigns/component/CampaignDetails";

export default async function CampaignsContentPage(props: {
    params: Promise<{ campaignId: string }>;
}) {
    const params = await props.params;
    return <CampaignDetails campaignId={params.campaignId} />;
}
