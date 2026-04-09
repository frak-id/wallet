import { useEffect, useRef } from "preact/hooks";

const DEFAULT_MESSAGE = "Share with your friends and earn rewards!";
const DEFAULT_CTA = "Share & earn";
const DEFAULT_BACKEND_URL = "https://backend.frak.id";
const PREVIEW_SHARING_URL = "https://example.com/share";

type PostPurchaseSettings = {
    sharing_url?: string;
    message?: string;
    cta_text?: string;
    merchant_id?: string;
    backend_url?: string;
};

/**
 * Order data extracted from Shopify APIs.
 * Shape varies between Thank You and Order Status pages.
 */
type OrderData = {
    orderId?: string;
    customerId?: string;
    token?: string;
};

/**
 * Fire-and-forget purchase tracking to Frak backend.
 * Acts as a fallback to the checkout web pixel.
 */
async function trackPurchase(
    backendUrl: string,
    payload: {
        orderId: string;
        merchantId: string;
        customerId?: string;
        token?: string;
    }
) {
    await fetch(`${backendUrl}/user/track/purchase`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        keepalive: true,
    });
}

/**
 * Post-purchase share card component.
 *
 * Renders on both the Thank You and Order Status pages.
 * Tracks the purchase via a direct fetch to the Frak backend (fallback
 * to the checkout web pixel), then displays a share prompt.
 *
 * All text is configurable via extension settings in the Checkout Editor.
 * When no sharing URL is configured, renders a preview placeholder
 * so merchants can see the card in the editor.
 */
export function PostPurchaseCard({
    settings,
    orderData,
}: {
    settings: Partial<PostPurchaseSettings>;
    orderData?: OrderData;
}) {
    const hasTracked = useRef(false);

    const sharingUrl = settings.sharing_url;
    const message = settings.message || DEFAULT_MESSAGE;
    const ctaText = settings.cta_text || DEFAULT_CTA;
    const merchantId = settings.merchant_id;
    const backendUrl = settings.backend_url || DEFAULT_BACKEND_URL;

    // Fire-and-forget purchase tracking (fallback to web pixel)
    useEffect(() => {
        if (hasTracked.current) return;
        if (!orderData?.orderId || !merchantId) return;

        hasTracked.current = true;

        trackPurchase(backendUrl, {
            orderId: orderData.orderId,
            merchantId,
            customerId: orderData.customerId,
            token: orderData.token,
        }).catch(() => {
            // Dedup handled server-side, silently ignore errors
        });
    }, [
        orderData?.orderId,
        merchantId,
        backendUrl,
        orderData?.customerId,
        orderData?.token,
    ]);

    // Preview mode: show placeholder when no sharing URL is set
    const isPreview = !sharingUrl;
    const resolvedUrl = sharingUrl || PREVIEW_SHARING_URL;

    return (
        <s-card padding="base">
            <s-stack direction="block" gap="base">
                <s-text emphasis="bold">{message}</s-text>
                {isPreview ? (
                    <s-text appearance="subdued" size="small">
                        Configure a Sharing URL in the extension settings to
                        activate this card.
                    </s-text>
                ) : null}
                <s-button
                    href={resolvedUrl}
                    target="_blank"
                    disabled={isPreview}
                >
                    {ctaText}
                </s-button>
            </s-stack>
        </s-card>
    );
}
