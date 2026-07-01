import { CopyableSnippet } from "app/components/ui/CopyableSnippet";
import { ExternalLink } from "app/components/ui/ExternalLink";
import { useTranslation } from "react-i18next";

/**
 * Manual banner install for themes without in-page app blocks (intermediate +
 * legacy). The `<frak-banner>` web component is pasted into the theme layout;
 * wording/colors/rewards are managed in the Frak business editor.
 */
const BANNER_TAG = "<frak-banner></frak-banner>";

export function ManualBannerInstall({
    themeLiquidUrl,
    customizeUrl,
}: {
    themeLiquidUrl: string;
    customizeUrl: string;
}) {
    const { t } = useTranslation();
    return (
        <s-section>
            <s-stack gap="base">
                <s-text>{t("appearance.manual.bannerDescription")}</s-text>

                <CopyableSnippet snippet={BANNER_TAG} />

                <ExternalLink href={themeLiquidUrl}>
                    {t("appearance.manual.editTheme")}
                </ExternalLink>

                <s-stack gap="small-100" alignItems="start">
                    <s-text>{t("appearance.manual.customizeNote")}</s-text>
                    <ExternalLink href={customizeUrl}>
                        {t("appearance.manual.openEditor")}
                    </ExternalLink>
                </s-stack>
            </s-stack>
        </s-section>
    );
}
