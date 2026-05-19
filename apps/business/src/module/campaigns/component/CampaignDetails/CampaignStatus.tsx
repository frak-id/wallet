import { capitalize } from "radash";
import { CampaignStateTag } from "@/module/campaigns/component/TableCampaigns/CampaignStateTag";
import {
    getAvailableTransitions,
    useStatusTransition,
} from "@/module/campaigns/hook/useStatusTransition";
import { Button } from "@/module/common/component/Button";
import { Column } from "@/module/common/component/Column";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { formatDate } from "@/module/common/utils/formatDate";
import type { Campaign } from "@/types/Campaign";
import * as styles from "./campaign-status.css";

export function CampaignStatus({ campaign }: { campaign: Campaign }) {
    const { mutate: transition, isPending } = useStatusTransition();
    const transitions = getAvailableTransitions(campaign.status);

    return (
        <Panel title={campaign.name}>
            <Column fullWidth={true}>
                <Row>
                    <strong>Status:</strong>
                    <CampaignStateTag
                        status={campaign.status}
                        bankDistributionStatus={campaign.bankDistributionStatus}
                    />
                </Row>
                <Row>
                    <strong>Created:</strong>
                    <span>{formatDate(new Date(campaign.createdAt))}</span>
                </Row>
                {campaign.publishedAt && (
                    <Row>
                        <strong>Published:</strong>
                        <span>
                            {formatDate(new Date(campaign.publishedAt))}
                        </span>
                    </Row>
                )}
                {campaign.expiresAt && (
                    <Row>
                        <strong>Expires:</strong>
                        <span>{formatDate(new Date(campaign.expiresAt))}</span>
                    </Row>
                )}

                {transitions.length > 0 && (
                    <div className={styles.campaignStatusActions}>
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
                    </div>
                )}
            </Column>
        </Panel>
    );
}
