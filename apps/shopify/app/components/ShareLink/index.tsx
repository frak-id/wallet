import { useTranslation } from "react-i18next";

type ShareLinkProps = {
    /** Absolute storefront URL the share modal will open on. */
    shopUrl: string;
};

/**
 * Settings card surfacing the merchant's `?frakAction=share` URL plus
 * copy-paste snippets for the most common email surfaces (Shopify
 * Notifications, Klaviyo, plain HTML).
 *
 * The SDK auto-opens the sharing modal when a visitor lands on a page
 * containing `?frakAction=share` — see
 * `sdk/components/src/utils/initFrakSdk.ts`.
 */
export function ShareLink({ shopUrl }: ShareLinkProps) {
    const { t } = useTranslation();

    // Strip a trailing slash so the produced URL has no double "//?".
    const baseUrl = shopUrl.replace(/\/$/, "");
    const shareUrl = `${baseUrl}?frakAction=share`;

    const liquidSnippet = `<a href="{{ shop.url }}?frakAction=share">${t(
        "share.snippets.linkText"
    )}</a>`;

    const klaviyoSnippet = `<a href="{{ organization.url }}?frakAction=share">${t(
        "share.snippets.linkText"
    )}</a>`;

    const htmlSnippet = `<a href="${shareUrl}">${t(
        "share.snippets.linkText"
    )}</a>`;

    const perCustomerLiquidSnippet = `<a href="{{ customer.metafields.frak.share_url }}">${t(
        "share.snippets.linkText"
    )}</a>`;

    const perCustomerKlaviyoSnippet = `<a href="{{ person.frak_share_url }}">${t(
        "share.snippets.linkText"
    )}</a>`;

    return (
        <s-stack gap="large">
            <s-section>
                <s-stack gap="small">
                    <s-heading>{t("share.url.title")}</s-heading>
                    <s-text>{t("share.url.description")}</s-text>
                    <CopyableCode
                        value={shareUrl}
                        copyLabel={t("share.copy")}
                        copiedMessage={t("share.copied")}
                    />
                </s-stack>
            </s-section>

            <s-section>
                <s-stack gap="small">
                    <s-heading>{t("share.snippets.shopify.title")}</s-heading>
                    <s-text>{t("share.snippets.shopify.description")}</s-text>
                    <CopyableCode
                        value={liquidSnippet}
                        copyLabel={t("share.copy")}
                        copiedMessage={t("share.copied")}
                    />
                </s-stack>
            </s-section>

            <s-section>
                <s-stack gap="small">
                    <s-heading>{t("share.snippets.klaviyo.title")}</s-heading>
                    <s-text>{t("share.snippets.klaviyo.description")}</s-text>
                    <CopyableCode
                        value={klaviyoSnippet}
                        copyLabel={t("share.copy")}
                        copiedMessage={t("share.copied")}
                    />
                </s-stack>
            </s-section>

            <s-section>
                <s-stack gap="small">
                    <s-heading>{t("share.snippets.html.title")}</s-heading>
                    <s-text>{t("share.snippets.html.description")}</s-text>
                    <CopyableCode
                        value={htmlSnippet}
                        copyLabel={t("share.copy")}
                        copiedMessage={t("share.copied")}
                    />
                </s-stack>
            </s-section>

            <s-section>
                <s-stack gap="small">
                    <s-heading>{t("share.perCustomer.title")}</s-heading>
                    <s-text>{t("share.perCustomer.description")}</s-text>

                    <s-stack gap="small">
                        <s-text>
                            <strong>
                                {t("share.perCustomer.shopify.title")}
                            </strong>
                        </s-text>
                        <s-text>
                            {t("share.perCustomer.shopify.description")}
                        </s-text>
                        <CopyableCode
                            value={perCustomerLiquidSnippet}
                            copyLabel={t("share.copy")}
                            copiedMessage={t("share.copied")}
                        />
                    </s-stack>

                    <s-stack gap="small">
                        <s-text>
                            <strong>
                                {t("share.perCustomer.klaviyo.title")}
                            </strong>
                        </s-text>
                        <s-text>
                            {t("share.perCustomer.klaviyo.description")}
                        </s-text>
                        <CopyableCode
                            value={perCustomerKlaviyoSnippet}
                            copyLabel={t("share.copy")}
                            copiedMessage={t("share.copied")}
                        />
                    </s-stack>
                </s-stack>
            </s-section>
        </s-stack>
    );
}

type CopyableCodeProps = {
    value: string;
    copyLabel: string;
    copiedMessage: string;
};

function CopyableCode({ value, copyLabel, copiedMessage }: CopyableCodeProps) {
    const handleCopy = async () => {
        await navigator.clipboard.writeText(value);
        window.shopify?.toast.show(copiedMessage);
    };

    return (
        <s-stack gap="small">
            <pre
                style={{
                    background: "var(--s-color-bg-surface-secondary, #f6f6f7)",
                    padding: "12px",
                    borderRadius: "var(--s-border-radius-base, 8px)",
                    margin: 0,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    fontFamily: "var(--s-font-family-mono, monospace)",
                    fontSize: "0.875rem",
                }}
            >
                <code>{value}</code>
            </pre>
            <s-button onClick={handleCopy}>{copyLabel}</s-button>
        </s-stack>
    );
}
