import { Badge } from "@frak-labs/design-system/components/Badge";
import { Box } from "@frak-labs/design-system/components/Box";
import { Tooltip } from "@/module/common/component/Tooltip";
import type { CampaignStatus, DistributionStatus } from "@/types/Campaign";

const bankHealthLabels: Record<string, string> = {
    depleted: "Bank empty — rewards can't distribute",
    paused: "Bank paused — distribution stopped",
    warning: "Needs attention — check your reward budget",
    not_deployed: "Bank not set up",
};

const bankBadgeLabels: Record<string, string> = {
    depleted: "No funds",
    paused: "Paused",
    warning: "Needs attention",
    not_deployed: "Setup needed",
};

export function CampaignStateTag({
    status,
    bankDistributionStatus,
}: {
    status: CampaignStatus;
    bankDistributionStatus?: DistributionStatus | null;
}) {
    const statusBadge = (() => {
        switch (status) {
            case "draft":
                return (
                    <Badge variant="neutral" size="small">
                        Draft
                    </Badge>
                );
            case "active":
                return (
                    <Badge variant="success" size="small">
                        Active
                    </Badge>
                );
            case "paused":
                return (
                    <Badge variant="warning" size="small">
                        Paused
                    </Badge>
                );
            case "archived":
                return (
                    <Badge variant="disabled" size="small">
                        Archived
                    </Badge>
                );
            default:
                return (
                    <Badge variant="error" size="small">
                        Unknown
                    </Badge>
                );
        }
    })();

    const showBankWarning =
        status === "active" &&
        bankDistributionStatus &&
        bankDistributionStatus !== "distributing";

    if (!showBankWarning) {
        return statusBadge;
    }

    const bankLabel = bankHealthLabels[bankDistributionStatus] ?? "Bank issue";
    const badgeLabel = bankBadgeLabels[bankDistributionStatus] ?? "Issue";

    return (
        <Box as="span" display="inline-flex" alignItems="center" gap="xxs">
            {statusBadge}
            <Tooltip content={bankLabel}>
                <Badge
                    variant={
                        bankDistributionStatus === "depleted"
                            ? "error"
                            : "warning"
                    }
                    size="small"
                >
                    {badgeLabel}
                </Badge>
            </Tooltip>
        </Box>
    );
}
