import type { loader as rootLoader } from "app/routes/app";
import { useTranslation } from "react-i18next";
import { useRouteLoaderData } from "react-router";
import { Activated } from "../Activated";
import { Instructions } from "../Instructions";
import { ExternalLink } from "../ui/ExternalLink";

interface BannerTabProps {
    isThemeHasFrakBanner: boolean;
}

export function BannerTab({ isThemeHasFrakBanner }: BannerTabProps) {
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const editorUrl = `https://${rootData?.shop?.myshopifyDomain}/admin/themes/current/editor`;
    const { t } = useTranslation();

    return (
        <s-section>
            <s-box>
                {isThemeHasFrakBanner ? (
                    <>
                        <Activated text={t("appearance.banner.activated")} />
                        <s-box paddingBlockStart="small">
                            <ExternalLink href={`${editorUrl}?context=apps`}>
                                {t("appearance.banner.link")}
                            </ExternalLink>
                        </s-box>
                    </>
                ) : (
                    <BannerNotActivated />
                )}
            </s-box>
        </s-section>
    );
}

function BannerNotActivated() {
    const { t } = useTranslation();
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const editorUrl = `https://${rootData?.shop?.myshopifyDomain}/admin/themes/current/editor`;

    return (
        <Instructions
            badgeText={t("appearance.banner.notActivated")}
            todoText={t("appearance.banner.todo")}
            image=""
        >
            <ExternalLink href={`${editorUrl}?context=apps`}>
                {t("appearance.banner.link")}
            </ExternalLink>
        </Instructions>
    );
}
