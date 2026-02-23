import { Tooltip } from "@frak-labs/ui/component/Tooltip";
import { Badge } from "@/module/common/component/Badge";
import type { CampaignStatus, DistributionStatus } from "@/types/Campaign";

const bankHealthLabels: Record<string, string> = {
    depleted: "Bank empty — rewards can't distribute",
    paused: "Bank paused — distribution stopped",
    low_funds: "Low funds — action needed",
    insufficient_allowance: "Allowance too low — increase distribution limit",
    not_deployed: "Bank not set up",
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

    // Only show bank warning for active campaigns with unhealthy banks
    const showBankWarning =
        status === "active" &&
        bankDistributionStatus &&
        bankDistributionStatus !== "distributing";

    if (!showBankWarning) {
        return statusBadge;
    }

    const bankLabel = bankHealthLabels[bankDistributionStatus] ?? "Bank issue";

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
            }}
        >
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
                    {bankDistributionStatus === "depleted"
                        ? "No funds"
                        : bankDistributionStatus === "paused"
                          ? "Paused"
                          : bankDistributionStatus === "low_funds"
                            ? "Low funds"
                            : bankDistributionStatus ===
                                "insufficient_allowance"
                              ? "Allowance"
                              : "Setup needed"}
                </Badge>
            </Tooltip>
        </span>
    );
}
