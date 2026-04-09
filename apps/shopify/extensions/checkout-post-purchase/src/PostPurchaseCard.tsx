const DEFAULT_MESSAGE = "Share with your friends and earn rewards!";
const DEFAULT_CTA = "Share & earn";
const PREVIEW_SHARING_URL = "https://example.com/share";

type PostPurchaseSettings = {
    sharing_url?: string;
    message?: string;
    cta_text?: string;
};

/**
 * Post-purchase share card component.
 *
 * Displays a share prompt with a CTA linking to the merchant's
 * sharing page where the full Frak SDK handles the referral flow.
 *
 * Works on both the Thank You page and Order Status page.
 * All text is configurable via extension settings in the Checkout Editor.
 *
 * When no sharing URL is configured, renders a preview placeholder
 * so merchants can see the card in the Checkout Editor.
 */
export function PostPurchaseCard({
    settings,
}: {
    settings: Partial<PostPurchaseSettings>;
}) {
    const sharingUrl = settings.sharing_url;
    const message = settings.message || DEFAULT_MESSAGE;
    const ctaText = settings.cta_text || DEFAULT_CTA;

    // Preview mode: show a placeholder when no sharing URL is set
    // so merchants can see the card in the Checkout Editor
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
