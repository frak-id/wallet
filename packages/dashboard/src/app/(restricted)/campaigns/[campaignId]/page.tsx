import { CampaignDetails } from "@/module/campaigns/component/CampaignDetails";

export default function CampaignsContentPage({
    params,
}: {
    params: { campaignId: string };
}) {
    return <CampaignDetails campaignId={params.campaignId} />;
}
