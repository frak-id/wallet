import { type Currency, formatAmount } from "@frak-labs/core-sdk";
import { useMutation } from "@tanstack/react-query";
import type { loader as rootLoader } from "app/routes/app";
import type { BankStatus } from "app/services.server/backendMerchant";
import {
    MAX_PENDING_PURCHASES,
    MAX_PURCHASE_AMOUNT,
    MIN_PURCHASE_AMOUNT,
} from "app/utils/purchaseLimits";
import { mapPurchaseStatus } from "app/utils/purchaseStatus";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouteLoaderData } from "react-router";
import type { PurchaseTable } from "../../../db/schema/purchaseTable";
import { ExternalButton, ExternalLink } from "../ui/ExternalLink";

export function PurchaseStatus({
    bankStatus,
    currentPurchases,
}: {
    bankStatus: BankStatus;
    currentPurchases: PurchaseTable["$inferSelect"][];
}) {
    const { t } = useTranslation();

    return (
        <s-section>
            <s-stack gap="base">
                <s-heading>{t("status.purchase.title")}</s-heading>

                <s-text>{t("status.purchase.description")}</s-text>

                {bankStatus.deployed && bankStatus.bankAddress && (
                    <>
                        <s-text tone="neutral">
                            {t("status.purchase.twoStepNotice")}
                        </s-text>
                        <CreatePurchase bankAddress={bankStatus.bankAddress} />
                    </>
                )}

                <ActivePurchases currentPurchases={currentPurchases} />
            </s-stack>
        </s-section>
    );
}

function ActivePurchases({
    currentPurchases,
}: {
    currentPurchases: PurchaseTable["$inferSelect"][];
}) {
    const { t } = useTranslation();

    if (currentPurchases.length === 0) {
        return null;
    }

    return (
        <s-stack gap="small">
            <s-heading>{t("status.purchase.activePurchases")}</s-heading>
            <s-table>
                <s-table-header-row>
                    <s-table-header listSlot="primary">
                        {t("status.purchase.amount")}
                    </s-table-header>
                    <s-table-header>
                        {t("status.purchase.status")}
                    </s-table-header>
                    <s-table-header>
                        {t("status.purchase.txHash")}
                    </s-table-header>
                    <s-table-header>
                        {t("status.purchase.createdAt")}
                    </s-table-header>
                    <s-table-header>
                        {t("status.purchase.actions")}
                    </s-table-header>
                </s-table-header-row>
                <s-table-body>
                    {currentPurchases.map((purchase) => {
                        const { status, variant } = mapPurchaseStatus(
                            purchase,
                            t
                        );
                        return (
                            <s-table-row key={purchase.id}>
                                <s-table-cell>
                                    {formatAmount(
                                        Number(purchase.amount),
                                        (purchase.currency ?? "eur") as Currency
                                    )}
                                </s-table-cell>
                                <s-table-cell>
                                    <s-badge tone={variant}>{status}</s-badge>
                                </s-table-cell>
                                <s-table-cell>
                                    {/* Table cells never wrap: a full hash pushes the Actions column out of the card. */}
                                    {purchase.txHash
                                        ? `${purchase.txHash.slice(0, 10)}…${purchase.txHash.slice(-8)}`
                                        : t("status.purchase.notAvailableYet")}
                                </s-table-cell>
                                <s-table-cell>
                                    {purchase.createdAt
                                        ? new Date(
                                              purchase.createdAt
                                          ).toLocaleString()
                                        : "-"}
                                </s-table-cell>
                                <s-table-cell>
                                    {purchase.status === "pending" && (
                                        <ExternalLink
                                            href={purchase.confirmationUrl}
                                        >
                                            {t("status.purchase.confirm")}
                                        </ExternalLink>
                                    )}
                                </s-table-cell>
                            </s-table-row>
                        );
                    })}
                </s-table-body>
            </s-table>
        </s-stack>
    );
}

/**
 * Component to fund the merchant bank via Shopify app purchase.
 * Uses the single bank address from the backend BankStatus.
 */
function CreatePurchase({ bankAddress }: { bankAddress: string }) {
    const [amount, setAmount] = useState("");
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const [error, setError] = useState<string | null>(null);
    const { t, i18n } = useTranslation();
    const currency = rootData?.shop.preferredCurrency ?? "EUR";
    const formatNumber = new Intl.NumberFormat(i18n.language).format;
    const amountLimits = {
        min: formatNumber(MIN_PURCHASE_AMOUNT),
        max: formatNumber(MAX_PURCHASE_AMOUNT),
        currency,
    };

    const {
        data: confirmationUrl,
        mutate: handleSubmit,
        isPending: isLoading,
    } = useMutation({
        mutationKey: ["createPurchase", amount, bankAddress],
        mutationFn: async () => {
            setError(null);
            const amountNumber = Number(amount);
            if (!amount || Number.isNaN(amountNumber) || amountNumber <= 0) {
                setError(t("status.purchase.errorInvalidAmount", amountLimits));
                return;
            }
            try {
                const url = `/api/purchase?amount=${amount}&bank=${bankAddress}`;
                const response = await fetch(url);
                if (response.status === 400) {
                    setError(
                        t("status.purchase.errorInvalidAmount", amountLimits)
                    );
                    return;
                }
                if (response.status === 409) {
                    setError(
                        t("status.purchase.errorTooManyPending", {
                            max: MAX_PENDING_PURCHASES,
                        })
                    );
                    return;
                }
                if (!response.ok) {
                    throw new Error("Failed to start billing process.");
                }
                return await response.json();
            } catch (e) {
                console.warn("Unable to start billing process", e);
                setError(t("status.purchase.errorBilling"));
            }
        },
    });

    return (
        <s-stack gap="small">
            <s-stack direction="inline" gap="small">
                <s-number-field
                    label={t("status.purchase.amountToFund")}
                    details={t("status.purchase.amountRules", amountLimits)}
                    value={amount}
                    onChange={(e) => setAmount(e.currentTarget.value ?? "")}
                    autocomplete="off"
                    min={0}
                    step={0.5}
                    disabled={isLoading || !!confirmationUrl}
                    suffix={currency}
                />
                <s-button
                    onClick={() => handleSubmit()}
                    loading={isLoading}
                    disabled={!amount || isLoading || !!confirmationUrl}
                    variant="primary"
                >
                    {t("status.purchase.fundBank")}
                </s-button>
            </s-stack>

            {error && <s-text tone="critical">{error}</s-text>}

            {confirmationUrl && (
                <>
                    <s-text>{t("status.purchase.confirmNow")}</s-text>
                    <ExternalButton href={confirmationUrl} variant="primary">
                        {t("status.purchase.confirmPurchase")}
                    </ExternalButton>
                </>
            )}
        </s-stack>
    );
}
