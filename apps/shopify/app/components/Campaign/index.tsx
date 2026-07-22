import type { DistributionStatus } from "@frak-labs/backend-elysia/domain/campaign-bank";
import { type Currency, formatAmount } from "@frak-labs/core-sdk";
import type { loader as rootLoader } from "app/routes/app";
import type { action } from "app/routes/app.campaigns";
import type {
    CampaignListItem,
    CampaignListResponse,
} from "app/services.server/backendMerchant";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher, useRouteLoaderData } from "react-router";

export function CampaignStatus({
    campaigns,
}: {
    campaigns: CampaignListResponse;
}) {
    const { t } = useTranslation();

    return (
        <s-section>
            <s-stack gap="base">
                <s-heading>{t("status.campaign.title")}</s-heading>

                <s-text>{t("status.campaign.description")}</s-text>

                <CampaignTable
                    campaigns={campaigns.campaigns}
                    bankDistributionStatus={campaigns.bankDistributionStatus}
                />
            </s-stack>
        </s-section>
    );
}

function CampaignTable({
    campaigns,
    bankDistributionStatus,
}: {
    campaigns: CampaignListItem[];
    bankDistributionStatus: DistributionStatus | null;
}) {
    const { t } = useTranslation();
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const currencySymbol = (rootData?.shop.preferredCurrency ??
        "eur") as Currency;

    if (campaigns.length === 0) {
        return (
            <s-section>
                <s-text tone="neutral">
                    {t("status.campaign.noCampaigns")}
                </s-text>
            </s-section>
        );
    }

    return (
        <s-section padding="none">
            <s-table>
                <s-table-header-row>
                    <s-table-header listSlot="primary">
                        {t("status.campaign.name")}
                    </s-table-header>
                    <s-table-header>
                        {t("status.campaign.status")}
                    </s-table-header>
                    <s-table-header>{t("status.campaign.date")}</s-table-header>
                    <s-table-header>
                        {t("status.campaign.budgetColumn")}
                    </s-table-header>
                    <s-table-header>
                        {t("status.campaign.rewardsColumn")}
                    </s-table-header>
                    <s-table-header>
                        {t("status.campaign.actionsColumn")}
                    </s-table-header>
                </s-table-header-row>
                <s-table-body>
                    {campaigns.map((campaign) => (
                        <CampaignTableRow
                            key={campaign.id}
                            campaign={campaign}
                            bankDistributionStatus={bankDistributionStatus}
                            currencySymbol={currencySymbol}
                        />
                    ))}
                </s-table-body>
            </s-table>
        </s-section>
    );
}

type CampaignActionIntent =
    | "pause-campaign"
    | "resume-campaign"
    | "archive-campaign"
    | "delete-campaign";

type CampaignActionConfig = {
    intent: CampaignActionIntent;
    labelKey: string;
    loadingKey: string;
    variant: "primary" | "tertiary";
    tone?: "critical";
};

const campaignActionConfig: Record<CampaignActionIntent, CampaignActionConfig> =
    {
        "pause-campaign": {
            intent: "pause-campaign",
            labelKey: "status.campaign.pause",
            loadingKey: "status.campaign.pausing",
            variant: "tertiary",
        },
        "resume-campaign": {
            intent: "resume-campaign",
            labelKey: "status.campaign.resume",
            loadingKey: "status.campaign.resuming",
            variant: "tertiary",
        },
        "archive-campaign": {
            intent: "archive-campaign",
            labelKey: "status.campaign.archive",
            loadingKey: "status.campaign.archiving",
            variant: "tertiary",
        },
        "delete-campaign": {
            intent: "delete-campaign",
            labelKey: "status.campaign.delete",
            loadingKey: "status.campaign.deleting",
            variant: "tertiary",
            tone: "critical",
        },
    };

function getCampaignActions(
    status: CampaignListItem["status"]
): CampaignActionIntent[] {
    if (status === "active") {
        return ["pause-campaign", "archive-campaign"];
    }

    if (status === "paused") {
        return ["resume-campaign", "archive-campaign"];
    }

    if (status === "draft") {
        return ["delete-campaign"];
    }

    return [];
}

function CampaignTableRow({
    campaign,
    bankDistributionStatus,
    currencySymbol,
}: {
    campaign: CampaignListItem;
    bankDistributionStatus: DistributionStatus | null;
    currencySymbol: Currency;
}) {
    const fetcher = useFetcher<typeof action>();
    const { t } = useTranslation();
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");

    const isSubmitting = fetcher.state !== "idle";
    const submittingIntent = fetcher.formData?.get("intent");
    const actions = getCampaignActions(campaign.status);

    const dateValue = campaign.publishedAt ?? campaign.createdAt;
    const formattedDate = dateValue
        ? new Date(dateValue).toLocaleDateString()
        : "-";

    const firstBudget = campaign.budgetConfig?.[0];
    const budgetUsage = firstBudget
        ? campaign.budgetUsed?.[firstBudget.label]
        : undefined;
    const formattedBudget = useMemo(() => {
        if (!firstBudget) return t("status.campaign.noBudget");
        const total = Number(firstBudget.amount);
        const used = budgetUsage?.used ?? 0;
        const remaining = Math.max(total - used, 0);
        const resetAt = budgetUsage?.resetAt
            ? new Date(budgetUsage.resetAt).toLocaleDateString()
            : null;
        const label = firstBudget.label ? ` (${firstBudget.label})` : "";
        const base = `${formatAmount(remaining, currencySymbol)} / ${formatAmount(total, currencySymbol)}${label}`;
        return resetAt
            ? `${base} — ${t("status.campaign.resetAt", { date: resetAt })}`
            : base;
    }, [firstBudget, budgetUsage, currencySymbol, t]);

    const rewardSummary = useMemo(() => {
        const rewards = campaign.rewards;
        if (!rewards?.length) return "-";
        return rewards
            .map((r) => {
                const who =
                    r.recipient === "referrer"
                        ? t("status.campaign.referrer")
                        : t("status.campaign.referee");
                if (r.amountType === "fixed") {
                    return `${who}: ${formatAmount(r.amount, currencySymbol)}`;
                }
                if (r.amountType === "percentage") {
                    return `${who}: ${r.percent}%`;
                }
                return `${who}: ${t("status.campaign.tiered")}`;
            })
            .join(", ");
    }, [campaign.rewards, currencySymbol, t]);

    const handleSubmit = useCallback(
        (
            intent:
                | "pause-campaign"
                | "resume-campaign"
                | "archive-campaign"
                | "delete-campaign"
        ) => {
            fetcher.submit(
                {
                    intent,
                    campaignId: campaign.id,
                },
                { method: "POST", action: "/app/campaigns" }
            );
        },
        [fetcher, campaign.id]
    );

    return (
        <s-table-row>
            <s-table-cell>{campaign.name}</s-table-cell>
            <s-table-cell>
                <CampaignStatusBadge
                    status={campaign.status}
                    bankDistributionStatus={bankDistributionStatus}
                />
            </s-table-cell>
            <s-table-cell>{formattedDate}</s-table-cell>
            <s-table-cell>{formattedBudget}</s-table-cell>
            <s-table-cell>{rewardSummary}</s-table-cell>
            <s-table-cell>
                <s-stack>
                    {actions.map((intent) => (
                        <CampaignActionButton
                            key={intent}
                            intent={intent}
                            isSubmitting={isSubmitting}
                            submittingIntent={submittingIntent}
                            onSubmit={handleSubmit}
                        />
                    ))}
                    <s-button
                        variant="tertiary"
                        onClick={() => {
                            // Prefer the merchant-scoped URL when we know
                            // the merchant id; fall back to the legacy URL
                            // (the business app redirects to the user's
                            // first merchant).
                            const base = rootData?.businessUrl ?? "";
                            const merchantId = rootData?.merchantId;
                            const url = merchantId
                                ? `${base}/m/${merchantId}/campaigns/list?campaign=${campaign.id}`
                                : `${base}/campaigns/${campaign.id}`;
                            window.open(url, "_blank");
                        }}
                    >
                        {t("status.campaign.viewDetails")}
                    </s-button>
                </s-stack>
            </s-table-cell>
        </s-table-row>
    );
}

function CampaignActionButton({
    intent,
    isSubmitting,
    submittingIntent,
    onSubmit,
}: {
    intent: CampaignActionIntent;
    isSubmitting: boolean;
    submittingIntent: FormDataEntryValue | null | undefined;
    onSubmit: (intent: CampaignActionIntent) => void;
}) {
    const { t } = useTranslation();
    const config = campaignActionConfig[intent];
    const isLoading = isSubmitting && submittingIntent === intent;

    return (
        <s-button
            variant={config.variant}
            tone={config.tone}
            loading={isLoading}
            disabled={isSubmitting}
            onClick={() => onSubmit(intent)}
        >
            {isLoading ? t(config.loadingKey) : t(config.labelKey)}
        </s-button>
    );
}

function CampaignStatusBadge({
    status,
    bankDistributionStatus,
}: {
    status: CampaignListItem["status"];
    bankDistributionStatus: DistributionStatus | null;
}) {
    const { t } = useTranslation();

    const statusBadge = (() => {
        switch (status) {
            case "draft":
                return (
                    <s-badge tone="info">
                        {t("status.campaign.statusDraft")}
                    </s-badge>
                );
            case "active":
                return (
                    <s-badge tone="success">
                        {t("status.campaign.statusActive")}
                    </s-badge>
                );
            case "paused":
                return (
                    <s-badge tone="warning">
                        {t("status.campaign.statusPaused")}
                    </s-badge>
                );
            case "archived":
                return <s-badge>{t("status.campaign.statusArchived")}</s-badge>;
            default:
                return <s-badge>{status}</s-badge>;
        }
    })();

    const showBankWarning =
        status === "active" &&
        bankDistributionStatus !== null &&
        bankDistributionStatus !== "distributing";

    if (!showBankWarning) {
        return statusBadge;
    }

    const bankBadge = (() => {
        switch (bankDistributionStatus) {
            case "depleted":
                return (
                    <s-badge tone="critical">
                        {t("status.campaign.bankDepleted")}
                    </s-badge>
                );
            case "paused":
                return (
                    <s-badge tone="warning">
                        {t("status.campaign.bankPaused")}
                    </s-badge>
                );
            case "warning":
                return (
                    <s-badge tone="warning">
                        {t("status.campaign.bankWarning")}
                    </s-badge>
                );
            case "not_deployed":
                return (
                    <s-badge tone="warning">
                        {t("status.campaign.bankNotDeployed")}
                    </s-badge>
                );
            default:
                return null;
        }
    })();

    if (!bankBadge) {
        return statusBadge;
    }

    return (
        <s-stack>
            {statusBadge}
            {bankBadge}
        </s-stack>
    );
}
