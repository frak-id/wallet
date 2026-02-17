import { useMutation } from "@tanstack/react-query";
import type { loader as rootLoader } from "app/routes/app";
import type { BankStatus } from "app/services.server/backendMerchant";
import type { BadgeTone } from "app/types/polaris";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouteLoaderData } from "react-router";
import type { PurchaseTable } from "../../../db/schema/purchaseTable";

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
                    <CreatePurchase bankAddress={bankStatus.bankAddress} />
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
                    <s-table-header>
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
                        const { status, variant } = mapStatus(purchase, t);
                        return (
                            <s-table-row key={purchase.id}>
                                <s-table-cell>{`$${purchase.amount}`}</s-table-cell>
                                <s-table-cell>
                                    <s-badge tone={variant}>{status}</s-badge>
                                </s-table-cell>
                                <s-table-cell>
                                    {purchase.txHash ?? "N/A"}
                                </s-table-cell>
                                <s-table-cell>
                                    {purchase.createdAt
                                        ? new Date(
                                              purchase.createdAt
                                          ).toLocaleString()
                                        : "N/A"}
                                </s-table-cell>
                                <s-table-cell>
                                    {purchase.status === "pending" && (
                                        <s-link
                                            href={purchase.confirmationUrl}
                                            target="_blank"
                                        >
                                            {t("status.purchase.confirm")}
                                        </s-link>
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
    const { t } = useTranslation();

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
                setError(t("status.purchase.errorInvalidAmount"));
                return;
            }
            try {
                const url = `/api/purchase?amount=${amount}&bank=${bankAddress}`;
                const response = await fetch(url);
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
                <s-text>
                    {t("status.purchase.selectBank")}: {bankAddress}
                </s-text>
                <s-number-field
                    label={t("status.purchase.amountToFund")}
                    value={amount}
                    onChange={(e) => setAmount(e.currentTarget.value)}
                    autocomplete="off"
                    min={0}
                    step={0.5}
                    disabled={isLoading || !!confirmationUrl}
                    suffix={rootData?.shop.preferredCurrency ?? "USD"}
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
                <s-button
                    href={confirmationUrl}
                    target="_blank"
                    variant="primary"
                >
                    {t("status.purchase.confirmPurchase")}
                </s-button>
            )}
        </s-stack>
    );
}

function mapStatus(
    purchase: PurchaseTable["$inferSelect"],
    t: (key: string) => string
): {
    status: string;
    variant: BadgeTone;
} {
    if (purchase.txStatus === "confirmed") {
        return {
            status: t("status.purchase.done"),
            variant: "success",
        };
    }
    if (purchase.txStatus === "pending" || purchase.status === "active") {
        return {
            status: t("status.purchase.pendingProcessing"),
            variant: "info",
        };
    }

    if (purchase.status === "declined") {
        return {
            status: t("status.purchase.declined"),
            variant: "warning",
        };
    }
    if (purchase.status === "expired") {
        return {
            status: t("status.purchase.expired"),
            variant: "warning",
        };
    }

    if (purchase.status === "pending") {
        return {
            status: t("status.purchase.waitingConfirmation"),
            variant: "info",
        };
    }

    return {
        status: t("status.purchase.pending"),
        variant: "info",
    };
}
