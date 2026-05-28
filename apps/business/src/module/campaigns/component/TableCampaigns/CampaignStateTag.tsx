import { Badge } from "@frak-labs/design-system/components/Badge";
import { useTranslation } from "react-i18next";
import { isEnded } from "@/module/campaigns/component/TableCampaigns/isEnded";
import type { CampaignStatus } from "@/types/Campaign";

export function CampaignStateTag({
    status,
    expiresAt,
}: {
    status: CampaignStatus;
    expiresAt: string | null;
}) {
    const { t } = useTranslation();
    const ended = isEnded(status, expiresAt);

    if (ended) {
        return (
            <Badge variant="disabled" size="small">
                {t("campaigns.status.ended")}
            </Badge>
        );
    }
    switch (status) {
        case "draft":
            return (
                <Badge variant="neutral" size="small">
                    {t("campaigns.status.draft")}
                </Badge>
            );
        case "active":
            return (
                <Badge variant="success" size="small">
                    {t("campaigns.status.active")}
                </Badge>
            );
        case "paused":
            return (
                <Badge variant="warning" size="small">
                    {t("campaigns.status.paused")}
                </Badge>
            );
        case "archived":
            return (
                <Badge variant="disabled" size="small">
                    {t("campaigns.status.archived")}
                </Badge>
            );
        default:
            return (
                <Badge variant="error" size="small">
                    {t("campaigns.status.unknown")}
                </Badge>
            );
    }
}
