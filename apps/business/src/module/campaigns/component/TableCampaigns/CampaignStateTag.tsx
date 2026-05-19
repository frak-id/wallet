import { Box } from "@frak-labs/design-system/components/Box";
import { Badge } from "@/module/common/component/Badge";
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
                return <Badge variant={"secondary"}>Draft</Badge>;
            case "active":
                return <Badge variant={"success"}>Active</Badge>;
            case "paused":
                return <Badge variant={"warning"}>Paused</Badge>;
            case "archived":
                return <Badge variant={"secondary"}>Archived</Badge>;
            default:
                return <Badge variant={"danger"}>Unknown</Badge>;
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
                            ? "danger"
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
