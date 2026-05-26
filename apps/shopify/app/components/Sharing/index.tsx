import type { loader as appLoader } from "app/routes/app";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRouteLoaderData } from "react-router";

/**
 * Build the canonical share URL for a given storefront host.
 *
 * Mirrors `buildShareUrl` from `services.server/metafields.ts` — kept
 * client-side so the merchant UI can render the link without an extra
 * loader round-trip. The SDK loader treats `?frakAction=share` as a
 * directive to auto-open the sharing modal (see `handleActionQueryParam`
 * in `sdk/components/src/bootstrap/initFrakSdk.ts`).
 */
function buildShareUrl(domain: string): string {
    return `https://${domain}/?frakAction=share`;
}

/**
 * Card surfacing a copy-paste sharing link merchants can drop into
 * newsletters / emails. Clicking the link auto-opens the storefront
 * sharing modal pre-filled with the merchant's active reward config.
 */
export function NewsletterShareLink() {
    const { t } = useTranslation();
    const rootData = useRouteLoaderData<typeof appLoader>("routes/app");
    const domain = rootData?.shop.domain;

    const shareUrl = useMemo(
        () => (domain ? buildShareUrl(domain) : null),
        [domain]
    );

    const handleCopy = useCallback(async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            shopify.toast.show(t("status.newsletterShare.copied"));
        } catch (error) {
            console.error("[newsletterShare] copy failed:", error);
            shopify.toast.show(t("status.newsletterShare.copyError"), {
                isError: true,
            });
        }
    }, [shareUrl, t]);

    if (!shareUrl) return null;

    return (
        <s-section>
            <s-stack gap="base">
                <s-heading>{t("status.newsletterShare.title")}</s-heading>
                <s-text>{t("status.newsletterShare.description")}</s-text>
                <s-box background="subdued" padding="base">
                    <s-stack
                        direction="inline"
                        gap="base"
                        alignItems="center"
                        justifyContent="space-between"
                    >
                        <s-text>{shareUrl}</s-text>
                        <s-button variant="primary" onClick={handleCopy}>
                            {t("status.newsletterShare.copy")}
                        </s-button>
                    </s-stack>
                </s-box>
            </s-stack>
        </s-section>
    );
}
