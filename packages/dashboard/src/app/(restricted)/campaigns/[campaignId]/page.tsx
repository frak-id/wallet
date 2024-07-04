export default function CampaignsContentPage({
    params,
}: {
    params: { campaignId: string };
}) {
    return <p>Content for campaign {params.campaignId}</p>;
}
