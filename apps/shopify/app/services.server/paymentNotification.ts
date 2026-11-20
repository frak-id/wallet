import { createHmac } from "node:crypto";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { levelForStatus, log } from "./logger";

/** Mirrors `ShopifyPaidPurchase` in the backend's PaymentNotificationOrchestrator. */
export type PaidPurchaseNotification = {
    purchaseId: number;
    shop: string;
    domain: string;
    amount: string;
    currency: string;
    bank: string;
    paidAt: string;
    test: boolean;
    shopName: string | null;
    email: string | null;
};

type ShopContact = { name: string | null; email: string | null };

/** Shop name + owner email for the ops notification; nulls when the shop cannot be queried. */
export async function fetchShopContact(
    admin: AdminApiContext | undefined
): Promise<ShopContact> {
    if (!admin) return { name: null, email: null };
    try {
        const response = await admin.graphql(
            `#graphql
            query shopContact { shop { name email } }`
        );
        const body = (await response.json()) as {
            data?: { shop?: { name?: string; email?: string } };
        };
        return {
            name: body.data?.shop?.name ?? null,
            email: body.data?.shop?.email ?? null,
        };
    } catch (err) {
        log.warn({ err }, "shop contact lookup failed");
        return { name: null, email: null };
    }
}

/**
 * Hand a paid bank top-up to the backend, which posts it to Slack. Signed like
 * a Stripe webhook (`timestamp.body`) with the app secret the backend also holds.
 * Never throws: the purchase is already recorded, the notification is best-effort.
 */
export async function notifyPaidPurchase(
    notification: PaidPurchaseNotification
): Promise<boolean> {
    const secret = process.env.SHOPIFY_API_SECRET;
    const backendUrl = process.env.BACKEND_URL;
    if (!(secret && backendUrl)) {
        log.warn(
            { purchaseId: notification.purchaseId },
            "payment notification skipped: backend or secret not configured"
        );
        return false;
    }

    const body = JSON.stringify(notification);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", secret)
        .update(`${timestamp}.${body}`)
        .digest("hex");

    try {
        const response = await fetch(
            `${backendUrl}/ext/payments/shopify/purchase`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-frak-timestamp": timestamp,
                    "x-frak-signature": signature,
                },
                body,
                signal: AbortSignal.timeout(10_000),
            }
        );
        if (!response.ok) {
            log[levelForStatus(response.status)](
                {
                    purchaseId: notification.purchaseId,
                    status: response.status,
                },
                "backend rejected the payment notification"
            );
        }
        return response.ok;
    } catch (err) {
        log.error(
            { err, purchaseId: notification.purchaseId },
            "payment notification failed"
        );
        return false;
    }
}
