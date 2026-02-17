import { type Currency, formatAmount } from "@frak-labs/core-sdk";
import { Collapsible } from "app/components/ui/Collapsible";
import { RangeSlider } from "app/components/ui/RangeSlider";
import type { loader as rootLoader } from "app/routes/app";
import type {
    BankStatus,
    CampaignResponse,
} from "app/services.server/backendMerchant";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouteLoaderData } from "react-router";
import type { Address } from "viem";
import { useCreateCampaignLink } from "../../hooks/useCreateCampaignLink";
import { useRefreshData } from "../../hooks/useRefreshData";

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
                    <CampaignCreation bankAddress={bankStatus.bankAddress} />
                </Collapsible>
            </s-stack>
        </s-section>
    );
}

function CampaignTable({ campaigns }: { campaigns: CampaignResponse[] }) {
    const { t } = useTranslation();
    const activeCampaigns = campaigns.filter((c) => c.status === "active");

    return (
        <s-section padding="none">
            <s-table>
                <s-table-header-row>
                    <s-table-header>{t("status.campaign.name")}</s-table-header>
                    <s-table-header>{t("status.campaign.type")}</s-table-header>
                    <s-table-header>
                        {t("status.campaign.active")}
                    </s-table-header>
                </s-table-header-row>
                <s-table-body>
                    {activeCampaigns.map((campaign) => (
                        <s-table-row key={campaign.id}>
                            <s-table-cell>{campaign.name}</s-table-cell>
                            <s-table-cell>{campaign.rule.trigger}</s-table-cell>
                            <s-table-cell>
                                <CampaignStatusBadge status={campaign.status} />
                            </s-table-cell>
                        </s-table-row>
                    ))}
                </s-table-body>
            </s-table>
        </s-section>
    );
}

function CampaignStatusBadge({
    status,
}: {
    status: CampaignResponse["status"];
}) {
    const { t } = useTranslation();

    const tone = status === "active" ? "success" : "warning";

    return <s-badge tone={tone}>{t("status.campaign.active")}</s-badge>;
}

function CampaignCreation({ bankAddress }: { bankAddress: Address | null }) {
    const { t } = useTranslation();
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");

    const [globalBudget, setGlobalBudget] = useState("");
    const [rawCAC, setRawCAC] = useState("");
    const [ratio, setRatio] = useState(90); // 90% referrer, 10% referee
    const [name, setName] = useState("");

    const isCreationDisabled = useMemo(() => {
        if (!bankAddress) return true;
        if (!globalBudget || !rawCAC) return true;

        return false;
    }, [globalBudget, rawCAC, bankAddress]);

    // Breakdown calculations
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

    // The creation link
    const creationLink = useCreateCampaignLink({
        bankId: bankAddress ?? "0x",
        globalBudget: Number(globalBudget),
        rawCAC: Number(rawCAC),
        ratio,
        name,
        merchantId: rootData?.merchantId ?? "",
    });
    const refresh = useRefreshData();

    // Open creation link
    const handleCreate = useCallback(() => {
        console.log("creationLink", creationLink);
        const openedWindow = window.open(
            creationLink,
            "frak-business",
            "menubar=no,status=no,scrollbars=no,fullscreen=no,width=500, height=800"
        );

        if (openedWindow) {
            openedWindow.focus();

            // Check every 500ms if the window is closed
            // If it is, revalidate the page
            const timer = setInterval(() => {
                if (openedWindow.closed) {
                    clearInterval(timer);
                    setTimeout(() => refresh(), 1000);
                }
            }, 500);
        }
    }, [creationLink, refresh]);

    if (!bankAddress) {
        return null;
    }

    return (
        <s-stack gap="base">
            <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="small">
                <s-grid-item>
                    <s-text-field
                        label={t("status.campaign.nameInput")}
                        value={name}
                        onChange={(e) => setName(e.currentTarget.value)}
                        autocomplete="off"
                    />
                </s-grid-item>
                <s-grid-item>
                    <s-text>
                        {t("status.campaign.bankSelect")}: {bankAddress}
                    </s-text>
                </s-grid-item>
            </s-grid>
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
                {t("status.campaign.createButton")}
            </s-button>
        </s-stack>
    );
}
