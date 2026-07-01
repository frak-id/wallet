import { Activated } from "app/components/Activated";
import { ExternalLink } from "app/components/ui/ExternalLink";
import { useTranslation } from "react-i18next";

/**
 * Install flow for the "intermediate" theme case: the theme supports app embeds
 * (so the global Frak Listener works, e.g. on vintage themes like Debut) but
 * NOT in-page app blocks. The Listener is enabled exactly like on a full OS 2.0
 * theme — no manual SDK snippet needed. The share button and banner live in the
 * Appearance tab (manual copy-paste view), so they're not duplicated here.
 */
export function IntermediateInstall({
    isThemeHasFrakActivated,
    editorUrl,
    listenerAppEmbedId,
}: {
    isThemeHasFrakActivated: boolean;
    editorUrl: string;
    listenerAppEmbedId: string;
}) {
    const { t } = useTranslation();

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

            {/* Enable the Listener app embed (works on this theme). */}
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
        </s-stack>
    );
}
