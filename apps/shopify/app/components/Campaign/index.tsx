import type { Stablecoin } from "@frak-labs/app-essentials";
import type { DistributionStatus } from "@frak-labs/backend-elysia/domain/campaign-bank";
import { type Currency, formatAmount } from "@frak-labs/core-sdk";
import { Collapsible } from "app/components/ui/Collapsible";
import { RangeSlider } from "app/components/ui/RangeSlider";
import { SkeletonDisplayText } from "app/components/ui/SkeletonDisplayText";
import type { loader as rootLoader } from "app/routes/app";
import type { action } from "app/routes/app.campaigns";
import type {
    BankStatus,
    CampaignResponse,
} from "app/services.server/backendMerchant";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher, useRouteLoaderData } from "react-router";
import type { Address } from "viem";
import { useMerchantBank } from "../../hooks/useMerchantBank";
import { currencyMetadata, formatTokenBalance } from "../../utils/tokenStatus";

export function CampaignStatus({
    campaigns,
    bankStatus,
}: {
    campaigns: CampaignResponse[];
    bankStatus: BankStatus;
}) {
    const { t } = useTranslation();
    const [creationOpen, setCreationOpen] = useState(false);

    return (
        <s-section>
            <s-stack gap="base">
                <s-heading>{t("status.campaign.title")}</s-heading>

                <s-text>{t("status.campaign.description")}</s-text>

                <CampaignTable campaigns={campaigns} />

                <s-button onClick={() => setCreationOpen(!creationOpen)}>
                    {t("status.campaign.createOpen")}
                </s-button>

                <Collapsible
                    open={creationOpen}
                    id="campaign-creation"
                    transition={{
                        duration: "500ms",
                        timingFunction: "ease-in-out",
                    }}
                >
                    <CampaignCreation
                        bankAddress={bankStatus.bankAddress}
                        onCreated={() => setCreationOpen(false)}
                    />
                </Collapsible>
            </s-stack>
        </s-section>
    );
}

function CampaignTable({ campaigns }: { campaigns: CampaignResponse[] }) {
    const { t } = useTranslation();
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const currencySymbol = (rootData?.shop.preferredCurrency ??
        "usd") as Currency;

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
            variant: "primary",
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
    status: CampaignResponse["status"]
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
    currencySymbol,
}: {
    campaign: CampaignResponse;
    currencySymbol: Currency;
}) {
    const fetcher = useFetcher<typeof action>();
    const { t } = useTranslation();

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
        const rewards = campaign.rule?.rewards;
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
                if (r.amountType === "tiered") {
                    return `${who}: ${t("status.campaign.tiered")}`;
                }
                return who;
            })
            .join(", ");
    }, [campaign.rule?.rewards, currencySymbol, t]);

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
                    bankDistributionStatus={campaign.bankDistributionStatus}
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
                        onClick={() =>
                            window.open(
                                `${process.env.BUSINESS_URL}/campaigns/${campaign.id}`,
                                "_blank"
                            )
                        }
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
    status: CampaignResponse["status"];
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

function BankTokenOverview({ bankAddress }: { bankAddress: Address }) {
    const { data: bankData, isLoading } = useMerchantBank({ bankAddress });
    const { t } = useTranslation();

    if (isLoading || !bankData) {
        return <SkeletonDisplayText size="small" />;
    }

    return (
        <s-section padding="none">
            <s-stack gap="small">
                <s-text>{t("status.campaign.availableTokens")}</s-text>
                <s-table>
                    <s-table-header-row>
                        <s-table-header listSlot="primary">
                            {t("status.bank.token")}
                        </s-table-header>
                        <s-table-header>
                            {t("status.bank.balance")}
                        </s-table-header>
                    </s-table-header-row>
                    <s-table-body>
                        {bankData.tokens.map((token) => {
                            const stablecoin = token.symbol as Stablecoin;
                            const meta = currencyMetadata[stablecoin];
                            const formattedBalance = formatTokenBalance(
                                token.balance,
                                stablecoin,
                                token.decimals
                            );
                            return (
                                <s-table-row key={token.address}>
                                    <s-table-cell>
                                        {meta.label} ({meta.provider})
                                    </s-table-cell>
                                    <s-table-cell>
                                        {formattedBalance}
                                    </s-table-cell>
                                </s-table-row>
                            );
                        })}
                    </s-table-body>
                </s-table>
            </s-stack>
        </s-section>
    );
}

function CampaignCreation({
    bankAddress,
    onCreated,
}: {
    bankAddress: Address | null;
    onCreated: () => void;
}) {
    const { t } = useTranslation();
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const fetcher = useFetcher<typeof action>();

    const [globalBudget, setGlobalBudget] = useState("");
    const [rawCAC, setRawCAC] = useState("");
    const [ratio, setRatio] = useState(90);
    const [name, setName] = useState("");

    const isSubmitting = fetcher.state !== "idle";
    const actionResult = fetcher.data;

    useEffect(() => {
        if (actionResult?.success) {
            setName("");
            setGlobalBudget("");
            setRawCAC("");
            setRatio(90);
            onCreated();
        }
    }, [actionResult?.success, onCreated]);

    const isCreationDisabled = useMemo(() => {
        if (!bankAddress) return true;
        if (!name.trim()) return true;
        if (!globalBudget || !rawCAC) return true;
        if (isSubmitting) return true;

        return false;
    }, [globalBudget, rawCAC, bankAddress, name, isSubmitting]);

    const breakdown = useMemo(() => {
        const cac = Number(rawCAC) || 0;

        const commission = cac * 0.2;
        const afterCommission = cac - commission;
        const referrerAmount = afterCommission * (ratio / 100);
        const refereeAmount = afterCommission * (1 - ratio / 100);

        const maxUsers = globalBudget && cac ? Number(globalBudget) / cac : 0;

        return {
            cac,
            commission,
            afterCommission,
            referrerAmount,
            refereeAmount,
            maxUsers,
        };
    }, [rawCAC, ratio, globalBudget]);

    const currencySymbol = (rootData?.shop.preferredCurrency ??
        "usd") as Currency;

    const handleCreate = useCallback(() => {
        fetcher.submit(
            {
                intent: "create-campaign",
                name,
                globalBudget,
                rawCAC,
                ratio: ratio.toString(),
            },
            { method: "POST", action: "/app/campaigns" }
        );
    }, [fetcher, name, globalBudget, rawCAC, ratio]);

    if (!bankAddress) {
        return null;
    }

    return (
        <s-stack gap="base">
            {actionResult?.error && (
                <s-banner tone="critical" dismissible>
                    {actionResult.error}
                </s-banner>
            )}

            <s-text-field
                label={t("status.campaign.nameInput")}
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                autocomplete="off"
            />

            <BankTokenOverview bankAddress={bankAddress} />
            <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="small">
                <s-grid-item>
                    <s-stack gap="small">
                        <s-number-field
                            label={t("status.campaign.budget")}
                            value={globalBudget}
                            onChange={(e) =>
                                setGlobalBudget(e.currentTarget.value)
                            }
                            inputMode="decimal"
                            min={0}
                            step={0.01}
                            suffix={currencySymbol}
                        />
                        <s-text>{t("status.campaign.budgetInfo")}</s-text>
                    </s-stack>
                </s-grid-item>
                <s-grid-item>
                    <s-stack gap="small">
                        <s-number-field
                            label={t("status.campaign.rawCAC")}
                            value={rawCAC}
                            onChange={(e) => setRawCAC(e.currentTarget.value)}
                            inputMode="decimal"
                            min={0}
                            step={0.01}
                            suffix={currencySymbol}
                        />
                        <s-text>{t("status.campaign.rawCACInfo")}</s-text>
                    </s-stack>
                </s-grid-item>
            </s-grid>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                }}
            >
                <s-text>{t("status.campaign.ratioReferrer")}</s-text>
                <RangeSlider
                    label={t("status.campaign.ratio")}
                    value={ratio}
                    min={10}
                    max={90}
                    step={5}
                    onChange={(value) => setRatio(value)}
                    output
                    helpText={t("status.campaign.ratioHelp")}
                />
                <s-text>{t("status.campaign.ratioReferee")}</s-text>
            </div>
            <s-stack gap="small">
                <s-text>
                    {`${t("status.campaign.breakdown.rawCAC")}: ${formatAmount(breakdown.cac, currencySymbol)}`}
                </s-text>
                <s-text>
                    {`${t("status.campaign.breakdown.commission")}: ${formatAmount(breakdown.commission, currencySymbol)} (20%)`}
                </s-text>
                <s-text>
                    {`${t("status.campaign.breakdown.referrer")}: ${formatAmount(breakdown.referrerAmount, currencySymbol)} (${ratio}%)`}
                </s-text>
                <s-text>
                    {`${t("status.campaign.breakdown.referee")}: ${formatAmount(breakdown.refereeAmount, currencySymbol)} (${100 - ratio}%)`}
                </s-text>
                <s-text>
                    {`${t("status.campaign.breakdown.newUser")}: ${breakdown.maxUsers.toFixed(0)}`}
                </s-text>
            </s-stack>
            <s-button
                variant="primary"
                onClick={handleCreate}
                disabled={isCreationDisabled}
            >
                {isSubmitting
                    ? t("status.campaign.creating")
                    : t("status.campaign.createButton")}
            </s-button>
        </s-stack>
    );
}
