import { Activated } from "app/components/Activated";
import styles from "app/components/LegacyInstall/LegacyInstall.module.css";
import { ExternalLink } from "app/components/ui/ExternalLink";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";

/**
 * The share-button web component merchants paste into their product template.
 * `classname` reuses the theme's own button class so the (light-DOM) button
 * inherits the store's native styling.
 */
const BUTTON_TAG = '<frak-button-share classname="btn"></frak-button-share>';

/**
 * Install flow for the "intermediate" theme case: the theme supports app embeds
 * (so the global Frak Listener works, e.g. on vintage themes like Debut) but
 * NOT in-page app blocks. The Listener is enabled exactly like on a full OS 2.0
 * theme — no manual SDK snippet needed — while the share button falls back to a
 * pasted web component because it can't be dropped into the page builder.
 */
export function IntermediateInstall({
    isThemeHasFrakActivated,
    editorUrl,
    listenerAppEmbedId,
    productTemplateUrl,
    customizeUrl,
}: {
    isThemeHasFrakActivated: boolean;
    editorUrl: string;
    listenerAppEmbedId: string;
    productTemplateUrl: string;
    customizeUrl: string;
}) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState(false);

    function copyButtonTag() {
        if (!navigator.clipboard?.writeText) {
            setCopyError(true);
            return;
        }
        navigator.clipboard.writeText(BUTTON_TAG).then(
            () => {
                setCopyError(false);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            },
            () => setCopyError(true)
        );
    }

    return (
        <s-stack gap="large">
            {/* Informational, not a warning: the theme works, it just lacks the
                one-click in-page block. */}
            <s-banner tone="info">
                <s-stack gap="small">
                    <s-text>
                        <strong>{t("theme.intermediate.banner")}</strong>
                    </s-text>
                    <s-text>{t("theme.intermediate.bannerDescription")}</s-text>
                </s-stack>
            </s-banner>

            {/* Step 1 — enable the Listener app embed (works on this theme). */}
            <s-section>
                <s-stack gap="base">
                    <s-heading>{t("theme.intermediate.embedTitle")}</s-heading>
                    {isThemeHasFrakActivated ? (
                        <>
                            <Activated text={t("theme.connected")} />
                            <ExternalLink
                                href={`${editorUrl}?context=apps&appEmbed=${listenerAppEmbedId}/listener`}
                            >
                                {t("theme.link")}
                            </ExternalLink>
                        </>
                    ) : (
                        <>
                            <s-text>{t("theme.todo")}</s-text>
                            <ExternalLink href={`${editorUrl}?context=apps`}>
                                {t("theme.link")}
                            </ExternalLink>
                        </>
                    )}
                </s-stack>
            </s-section>

            {/* Step 2 — manual share button (optional). */}
            <s-section>
                <s-stack gap="base">
                    <s-heading>{t("theme.intermediate.buttonTitle")}</s-heading>
                    <s-text>{t("theme.legacy.step2")}</s-text>

                    <div className={styles.snippetWrapper}>
                        <pre className={styles.snippet}>{BUTTON_TAG}</pre>
                        <div className={styles.copyButton}>
                            <s-button variant="primary" onClick={copyButtonTag}>
                                {copied
                                    ? t("theme.legacy.copied")
                                    : t("theme.legacy.copyButton")}
                            </s-button>
                        </div>
                    </div>
                    {copyError && (
                        <s-text color="subdued">
                            {t("theme.legacy.copyError")}
                        </s-text>
                    )}

                    <s-text color="subdued">
                        <Trans
                            i18nKey="theme.legacy.step2ClassHint"
                            components={{
                                code: <code className={styles.inlineCode} />,
                            }}
                        />
                    </s-text>
                    <s-text color="subdued">
                        <Trans
                            i18nKey="theme.legacy.step2SectionHint"
                            components={{
                                code: <code className={styles.inlineCode} />,
                            }}
                        />
                    </s-text>
                    <ExternalLink href={productTemplateUrl}>
                        {t("theme.legacy.step2Link")}
                    </ExternalLink>

                    <s-stack gap="small-100" alignItems="start">
                        <s-text>{t("theme.legacy.step3")}</s-text>
                        <ExternalLink href={customizeUrl}>
                            {t("theme.legacy.step3Link")}
                        </ExternalLink>
                    </s-stack>
                </s-stack>
            </s-section>
        </s-stack>
    );
}
