import { CampaignDetails } from "@/module/campaigns/component/CampaignDetails";
import { Head } from "@/module/common/component/Head";

export default function CampaignsContentPage({
    params,
}: {
    params: { campaignId: string };
}) {
    return (
        <>
            <Head title={{ content: "Campaign details" }} />
            <CampaignDetails campaignId={params.campaignId} />
        </>
    );
}
