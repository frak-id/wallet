import { useMemo } from "preact/hooks";

const DEFAULT_MESSAGE = "Share with your friends and earn rewards!";
const DEFAULT_CTA = "Share & earn";
const DEFAULT_WALLET_URL = "https://wallet.frak.id";

type PostPurchaseSettings = {
    sharing_url?: string;
    merchant_id?: string;
    message?: string;
    cta_text?: string;
    wallet_url?: string;
};

/**
 * Post-purchase share card component.
 *
 * Renders on both the Thank You and Order Status pages.
 * Constructs a URL to the external Frak sharing page and displays
 * a card with a CTA button that opens it in a new tab.
 *
 * Purchase tracking is handled separately by the checkout web pixel.
 *
 * All text is configurable via extension settings in the Checkout Editor.
 * When required settings are missing, renders a preview placeholder
 * so merchants can see the card in the editor.
 */
export function PostPurchaseCard({
    settings,
}: {
    settings: Partial<PostPurchaseSettings>;
}) {
    const sharingUrl = settings.sharing_url;
    const merchantId = settings.merchant_id;
    const walletUrl = settings.wallet_url || DEFAULT_WALLET_URL;
    const message = settings.message || DEFAULT_MESSAGE;
    const ctaText = settings.cta_text || DEFAULT_CTA;

    const isPreview = !sharingUrl || !merchantId;

    // Build external sharing page URL with merchant params
    const sharingPageUrl = useMemo(() => {
        if (!sharingUrl || !merchantId) return null;
        const url = new URL(`${walletUrl}/share`);
        url.searchParams.set("m", merchantId);
        url.searchParams.set("url", sharingUrl);
        return url.toString();
    }, [walletUrl, merchantId, sharingUrl]);

    return (
        <s-card padding="base">
            <s-stack direction="block" gap="base">
                <s-text emphasis="bold">{message}</s-text>
                {isPreview ? (
                    <s-text appearance="subdued" size="small">
                        Configure the Sharing URL and Merchant ID in the
                        extension settings to activate this card.
                    </s-text>
                ) : null}
                <s-button
                    href={sharingPageUrl ?? "#"}
                    target="_blank"
                    disabled={isPreview}
                >
                    {ctaText}
                </s-button>
            </s-stack>
        </s-card>
    );
}
