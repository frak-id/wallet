import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useCallback } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { data, useLoaderData } from "react-router";
import type { PurchaseTable } from "../../db/schema/purchaseTable";
import { DescriptionList } from "../components/ui/DescriptionList";
import { getPurchase } from "../services.server/purchase";
import { parseChargeId } from "../utils/url";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    // Get and parse the charge_id query param
    const chargeId = parseChargeId(
        new URL(request.url).searchParams.get("charge_id")
    );
    if (chargeId === null) {
        return data({ purchase: null });
    }

    // Try to get the purchase
    try {
        const purchase = await getPurchase(chargeId);
        return data({ purchase });
    } catch (error) {
        console.warn("Purchase not found", error);
        return data({ purchase: null });
    }
};

export default function PostPurchase() {
    const { purchase } = useLoaderData<typeof loader>();

    const close = useCallback(() => {
        window.close();
    }, []);

    return (
        <AppProvider embedded={false}>
            <s-page>
                <s-stack gap="large-400" alignItems="center">
                    <img
                        src="https://frak.id/assets/logo-frak.png"
                        alt="Logo"
                    />
                    {purchase ? (
                        <PurchasePresent purchase={purchase} />
                    ) : (
                        <NoPurchase />
                    )}
                    <s-button onClick={close}>Close</s-button>
                </s-stack>
            </s-page>
        </AppProvider>
    );
}

function PurchasePresent({
    purchase,
}: {
    purchase: PurchaseTable["$inferSelect"];
}) {
    return (
        <>
            <div style={{ textAlign: "center" }}>
                <s-heading>
                    Thank's for your purchase of ${purchase.amount}!
                </s-heading>
            </div>
            <div style={{ textAlign: "center" }}>
                <s-text>
                    We will process your purchase within 2-5 business days.
                </s-text>
            </div>
            <div style={{ textAlign: "center" }}>
                <s-text>
                    You can track your purchase status in the{" "}
                    <s-link href="/app/funding">funding page</s-link>.
                </s-text>
            </div>
            <div style={{ textAlign: "center" }}>
                <s-text>
                    If you have any questions, please contact us at{" "}
                    <s-link href="mailto:hello@frak-labs.com">
                        hello@frak-labs.com
                    </s-link>
                    .
                </s-text>
            </div>
            <s-section>
                <s-heading>Purchase details</s-heading>
                <DescriptionList
                    items={[
                        {
                            term: "Amount",
                            description: purchase.amount,
                        },
                        {
                            term: "Shopify status",
                            description: purchase.status,
                        },
                        {
                            term: "Frak processing status",
                            description: purchase.txStatus ?? "pending",
                        },
                        {
                            term: "Transaction hash",
                            description: purchase.txHash ?? "Not processed yet",
                        },
                    ]}
                />
            </s-section>
        </>
    );
}

function NoPurchase() {
    return (
        <>
            <div style={{ textAlign: "center" }}>
                <s-heading>Purchase not found</s-heading>
            </div>
            <div style={{ textAlign: "center" }}>
                <s-text>
                    If that's an error, please contact us at{" "}
                    <s-link href="mailto:hello@frak-labs.com">
                        hello@frak-labs.com
                    </s-link>
                    .
                </s-text>
            </div>
        </>
    );
}
