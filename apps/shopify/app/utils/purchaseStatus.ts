import type { BadgeTone } from "app/types/polaris";

type PurchaseStatusInput = {
    status: string;
    txStatus?: string | null;
};

/** Merchant-facing label and badge tone for a purchase, from its Shopify and Frak statuses. */
export function mapPurchaseStatus(
    purchase: PurchaseStatusInput,
    t: (key: string) => string
): { status: string; variant: BadgeTone } {
    if (purchase.txStatus === "confirmed") {
        return { status: t("status.purchase.done"), variant: "success" };
    }
    if (purchase.txStatus === "pending" || purchase.status === "active") {
        return {
            status: t("status.purchase.pendingProcessing"),
            variant: "info",
        };
    }
    if (purchase.status === "declined") {
        return { status: t("status.purchase.declined"), variant: "warning" };
    }
    if (purchase.status === "expired") {
        return { status: t("status.purchase.expired"), variant: "warning" };
    }
    if (purchase.status === "pending") {
        return {
            status: t("status.purchase.waitingConfirmation"),
            variant: "info",
        };
    }
    return { status: t("status.purchase.pending"), variant: "info" };
}
