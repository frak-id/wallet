import { ExternalLink } from "app/components/ui/ExternalLink";
import type { loader as appLoader } from "app/routes/app";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useRouteLoaderData } from "react-router";
import { buildFrakSnippet } from "./buildFrakSnippet";
import styles from "./LegacyInstall.module.css";

/**
 * The share-button web component merchants paste into their product template.
 * `classname` reuses the theme's own button class so the (light-DOM) button
 * inherits the store's native button styling. Defaults to `btn` (common on
 * vintage/Slate-based themes — the manual-install audience); merchants swap it
 * for their theme's button class.
 */
const BUTTON_TAG = '<frak-button-share classname="btn"></frak-button-share>';

export function LegacyInstall({
    merchantId,
    walletUrl,
    componentsUrl,
    businessUrl,
}: {
    merchantId: string | null;
    walletUrl: string;
    componentsUrl: string;
    businessUrl: string;
}) {
    const { t } = useTranslation();
    const rootData = useRouteLoaderData<typeof appLoader>("routes/app");
    // Deep-link the code editor to the relevant file: theme.liquid for the SDK
    // snippet (step 1) and the product template for the share button (step 2).
    // Vintage/non-OS-2.0 themes render the product page from
    // templates/product.liquid.
    const themeBase = `https://${rootData?.shop?.myshopifyDomain}/admin/themes/current`;
    const themeLiquidUrl = `${themeBase}?key=layout/theme.liquid`;
    const productTemplateUrl = `${themeBase}?key=templates/product.liquid`;
    // Deep-link straight to the merchant's branding editor in the business app
    // (logo / wording / rewards). Fall back to the base when merchantId is
    // missing (onboarding not complete).
    const customizeUrl = merchantId
        ? `${businessUrl}/m/${merchantId}/merchant/customize`
        : businessUrl;
    // `copiedKey` tracks which button last copied, so each shows its own
    // "Copied!" confirmation; `copyError` is shared.
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [copyError, setCopyError] = useState(false);

    const snippet = merchantId
        ? buildFrakSnippet({ merchantId, walletUrl, componentsUrl })
        : null;

    function copy(text: string, key: string) {
        // The embedded admin iframe frequently blocks clipboard-write; show a
        // "select it manually" hint instead of failing silently. The snippet
        // <pre> is selectable, so manual copy always works.
        if (!navigator.clipboard?.writeText) {
            setCopyError(true);
            return;
        }
        navigator.clipboard.writeText(text).then(
            () => {
                setCopyError(false);
                setCopiedKey(key);
                setTimeout(() => setCopiedKey(null), 2000);
            },
            () => setCopyError(true)
        );
    }

    return (
        <s-stack gap="large">
            {/* Upgrade nudge — lead with the warning per coworker requirement */}
            <s-banner tone="warning">
                <s-stack gap="small">
                    <s-text>
                        <strong>{t("theme.legacy.upgradeWarning")}</strong>
                    </s-text>
                    <s-text>{t("theme.legacy.upgradeDescription")}</s-text>
                </s-stack>
            </s-banner>

            {/* Manual install fallback */}
            <s-section>
                <s-stack gap="base">
                    <s-heading>{t("theme.legacy.snippetTitle")}</s-heading>
                    <s-text>{t("theme.legacy.snippetDescription")}</s-text>

                    {snippet ? (
                        <div className={styles.snippetWrapper}>
                            <pre className={styles.snippet}>{snippet}</pre>
                            <div className={styles.copyButton}>
                                <s-button
                                    variant="primary"
                                    onClick={() => copy(snippet, "snippet")}
                                >
                                    {copiedKey === "snippet"
                                        ? t("theme.legacy.copied")
                                        : t("theme.legacy.copySnippet")}
                                </s-button>
                            </div>
                            {copyError && (
                                <s-text color="subdued">
                                    {t("theme.legacy.copyError")}
                                </s-text>
                            )}
                        </div>
                    ) : (
                        <s-banner tone="critical">
                            <s-text>{t("theme.legacy.noMerchantId")}</s-text>
                        </s-banner>
                    )}

                    <s-stack gap="base">
                        <s-text>
                            <strong>{t("theme.legacy.steps")}</strong>
                        </s-text>
                        <s-stack gap="small-100" alignItems="start">
                            <s-text>1. {t("theme.legacy.step1")}</s-text>
                            <ExternalLink href={themeLiquidUrl}>
                                {t("theme.legacy.step1Link")}
                            </ExternalLink>
                        </s-stack>
                        <s-stack gap="small-100" alignItems="start">
                            <s-stack
                                direction="inline"
                                gap="small"
                                alignItems="center"
                            >
                                <s-text>2. {t("theme.legacy.step2")}</s-text>
                                <s-button
                                    variant="primary"
                                    onClick={() => copy(BUTTON_TAG, "button")}
                                >
                                    {copiedKey === "button"
                                        ? t("theme.legacy.copied")
                                        : t("theme.legacy.copyButton")}
                                </s-button>
                            </s-stack>
                            <s-text color="subdued">
                                <Trans
                                    i18nKey="theme.legacy.step2ClassHint"
                                    components={{
                                        code: (
                                            <code
                                                className={styles.inlineCode}
                                            />
                                        ),
                                    }}
                                />
                            </s-text>
                            <s-text color="subdued">
                                <Trans
                                    i18nKey="theme.legacy.step2SectionHint"
                                    components={{
                                        code: (
                                            <code
                                                className={styles.inlineCode}
                                            />
                                        ),
                                    }}
                                />
                            </s-text>
                            <ExternalLink href={productTemplateUrl}>
                                {t("theme.legacy.step2Link")}
                            </ExternalLink>
                        </s-stack>
                        <s-stack gap="small-100" alignItems="start">
                            <s-text>3. {t("theme.legacy.step3")}</s-text>
                            <ExternalLink href={customizeUrl}>
                                {t("theme.legacy.step3Link")}
                            </ExternalLink>
                        </s-stack>
                    </s-stack>
                </s-stack>
            </s-section>
        </s-stack>
    );
}
