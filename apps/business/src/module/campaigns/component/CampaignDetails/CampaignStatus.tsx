import { Box } from "@frak-labs/design-system/components/Box";
import {
    Card,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { capitalize } from "radash";
import { CampaignStateTag } from "@/module/campaigns/component/TableCampaigns/CampaignStateTag";
import {
    getAvailableTransitions,
    useStatusTransition,
} from "@/module/campaigns/hook/useStatusTransition";
import { Button } from "@/module/common/component/Button";
import { formatDate } from "@/module/common/utils/formatDate";
import type { Campaign } from "@/types/Campaign";

export function CampaignStatus({ campaign }: { campaign: Campaign }) {
    const { mutate: transition, isPending } = useStatusTransition();
    const transitions = getAvailableTransitions(campaign.status);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{campaign.name}</CardTitle>
            </CardHeader>
            <Stack space="m">
                <Inline space="m" alignY="bottom">
                    <strong>Status:</strong>
                    <CampaignStateTag
                        status={campaign.status}
                        expiresAt={campaign.expiresAt}
                        bankDistributionStatus={campaign.bankDistributionStatus}
                    />
                </Inline>
                <Inline space="m" alignY="bottom">
                    <strong>Created:</strong>
                    <span>{formatDate(new Date(campaign.createdAt))}</span>
                </Inline>
                {campaign.publishedAt && (
                    <Inline space="m" alignY="bottom">
                        <strong>Published:</strong>
                        <span>
                            {formatDate(new Date(campaign.publishedAt))}
                        </span>
                    </Inline>
                )}
                {campaign.expiresAt && (
                    <Inline space="m" alignY="bottom">
                        <strong>Expires:</strong>
                        <span>{formatDate(new Date(campaign.expiresAt))}</span>
                    </Inline>
                )}

                {transitions.length > 0 && (
                    <Box display="flex" gap="m" marginTop="m">
                        {transitions.map((action) => (
                            <Button
                                key={action}
                                variant={
                                    action === "archive"
                                        ? "destructive"
                                        : "secondary"
                                }
                                disabled={isPending}
                                loading={isPending}
                                onClick={() =>
                                    transition({
                                        merchantId: campaign.merchantId,
                                        campaignId: campaign.id,
                                        action,
                                    })
                                }
                            >
                                {capitalize(action)}
                            </Button>
                        ))}
                    </Box>
                )}
            </Stack>
        </Card>
    );
}
