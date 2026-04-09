import { useMemo } from "preact/hooks";

const DEFAULT_MESSAGE = "Earn rewards through sharing";
const DEFAULT_SUBTITLE = "Recommend this product to your friends";
const DEFAULT_DESCRIPTION = "If they buy, they earn... and so do you!";
const DEFAULT_CTA = "Share & earn";
const DEFAULT_BADGE = "New";
const DEFAULT_WALLET_URL = "https://wallet.frak.id";

/**
 * Extension settings configured by merchants in the Checkout Editor.
 * Only text customization — merchantId/walletUrl/logoUrl come from metafields.
 */
type PostPurchaseSettings = {
    sharing_url?: string;
    message?: string;
    subtitle?: string;
    description?: string;
    cta_text?: string;
    badge_text?: string;
};

type ProductInfo = {
    title: string;
    imageUrl?: string;
};

/**
 * Post-purchase sharing card component.
 *
 * Renders on both the Thank You and Order Status pages.
 * Constructs a URL to the external Frak sharing page and displays
 * a badge, heading, description, and CTA button that opens it in a new tab.
 *
 * Purchase tracking is handled separately by the checkout web pixel.
 *
 * Configuration sources:
 *  - merchantId, walletUrl, logoUrl → auto-read from shop metafields (frak.*)
 *  - sharing_url → extension setting (merchant configures in Checkout Editor)
 *  - text fields → extension settings with sensible defaults
 *
 * When required data is missing, renders a preview placeholder
 * so merchants can see the card in the editor.
 */
export function PostPurchaseCard({
    settings,
    clientId,
    shopName,
    storefrontUrl,
    products,
    merchantId,
    walletUrl,
    logoUrl,
    orderId,
    checkoutToken,
}: {
    settings: Partial<PostPurchaseSettings>;
    clientId?: string;
    shopName?: string;
    /** Shop storefront URL — fallback when sharing_url setting is empty */
    storefrontUrl?: string;
    products?: ProductInfo[];
    /** From frak.merchant_id shop metafield */
    merchantId?: string;
    /** From frak.wallet_url shop metafield */
    walletUrl?: string;
    /** From frak.appearance shop metafield */
    logoUrl?: string;
    /** Shopify order ID (numeric, available on OrderStatus surface) */
    orderId?: string;
    /** Checkout token (available on ThankYou surface, correlates with web pixel data) */
    checkoutToken?: string;
}) {
    const sharingUrl = settings.sharing_url || storefrontUrl;
    const resolvedWalletUrl = walletUrl || DEFAULT_WALLET_URL;
    const message = settings.message || DEFAULT_MESSAGE;
    const subtitle = settings.subtitle || DEFAULT_SUBTITLE;
    const description = settings.description || DEFAULT_DESCRIPTION;
    const ctaText = settings.cta_text || DEFAULT_CTA;
    const badgeText = settings.badge_text || DEFAULT_BADGE;

    const isPreview = !merchantId;

    // Build external sharing page URL with all params
    const sharingPageUrl = useMemo(() => {
        if (!sharingUrl || !merchantId) return null;
        const url = new URL(`${resolvedWalletUrl}/sharing`);
        url.searchParams.set("merchantId", merchantId);
        url.searchParams.set("link", sharingUrl);
        if (clientId) {
            url.searchParams.set("clientId", clientId);
        }
        if (shopName) {
            url.searchParams.set("appName", shopName);
        }
        if (logoUrl) {
            url.searchParams.set("logoUrl", logoUrl);
        }
        if (products && products.length > 0) {
            url.searchParams.set("products", JSON.stringify(products));
        }
        if (orderId) {
            url.searchParams.set("orderId", orderId);
        }
        if (checkoutToken) {
            url.searchParams.set("checkoutToken", checkoutToken);
        }
        return url.toString();
    }, [
        resolvedWalletUrl,
        merchantId,
        sharingUrl,
        clientId,
        shopName,
        logoUrl,
        products,
        orderId,
        checkoutToken,
    ]);

    return (
        <s-stack direction="block" gap="small">
            <s-badge>{badgeText}</s-badge>
            <s-heading>{message}</s-heading>
            <s-text type="strong">{subtitle}</s-text>
            <s-text color="subdued">{description}</s-text>
            {isPreview ? (
                <s-text color="subdued" type="small">
                    Configure the Sharing URL in the extension settings and
                    ensure the Frak app is installed to activate this card.
                </s-text>
            ) : null}
            <s-button
                variant="primary"
                href={sharingPageUrl ?? "#"}
                target="_blank"
                disabled={isPreview}
            >
                {ctaText}
            </s-button>
            <s-text color="subdued" type="small">
                Powered by frak
            </s-text>
        </s-stack>
    );
}
