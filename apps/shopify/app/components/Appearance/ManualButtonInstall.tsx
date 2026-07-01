import {
    CopyableSnippet,
    inlineCodeClass,
} from "app/components/ui/CopyableSnippet";
import { ExternalLink } from "app/components/ui/ExternalLink";
import { Trans, useTranslation } from "react-i18next";

/**
 * Manual share-button install for themes without in-page app blocks
 * (intermediate + legacy). Mirrors the OS-2.0 ButtonTab intent but via a
 * copy-paste web-component tag plus deep-links to the theme editor and the
 * Frak business editor — the same shape the Settings → Theme page used to show.
 */
const BUTTON_TAG = '<frak-button-share classname="btn"></frak-button-share>';

export function ManualButtonInstall({
    productTemplateUrl,
    customizeUrl,
}: {
    productTemplateUrl: string;
    customizeUrl: string;
}) {
    const { t } = useTranslation();
    return (
        <s-section>
            <s-stack gap="base">
                <s-text>{t("appearance.manual.buttonDescription")}</s-text>

                <CopyableSnippet snippet={BUTTON_TAG} />

                <s-text color="subdued">
                    <Trans
                        i18nKey="appearance.manual.classHint"
                        components={{
                            code: <code className={inlineCodeClass} />,
                        }}
                    />
                </s-text>
                <s-text color="subdued">
                    <Trans
                        i18nKey="appearance.manual.sectionHint"
                        components={{
                            code: <code className={inlineCodeClass} />,
                        }}
                    />
                </s-text>

                <ExternalLink href={productTemplateUrl}>
                    {t("appearance.manual.editProductTemplate")}
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
