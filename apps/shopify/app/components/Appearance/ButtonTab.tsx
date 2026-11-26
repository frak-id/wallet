import type { loader as rootLoader } from "app/routes/app";
import type { loader } from "app/routes/app.appearance";
import { useTranslation } from "react-i18next";
import { useLoaderData, useRouteLoaderData } from "react-router";
import screenShareButton from "../../assets/share-button.png";
import { Activated } from "../Activated";
import { Instructions } from "../Instructions";
import { ExternalLink } from "../ui/ExternalLink";

type ButtonTabProps = {
    isThemeHasFrakButton: boolean;
    firstProduct?: {
        handle: string;
    } | null;
};

export function ButtonTab({
    isThemeHasFrakButton,
    firstProduct,
}: ButtonTabProps) {
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const editorUrl = `https://${rootData?.shop.myshopifyDomain}/admin/themes/current/editor`;
    const { t } = useTranslation();

    return (
        <s-box>
            {isThemeHasFrakButton && (
                <>
                    <Activated text={t("appearance.shareButton.activated")} />
                    <s-box paddingBlockStart="small">
                        {firstProduct ? (
                            <ExternalLink
                                href={`${editorUrl}?previewPath=/products/${firstProduct.handle}`}
                            >
                                {t("appearance.shareButton.link")}
                            </ExternalLink>
                        ) : (
                            <NoProduct />
                        )}
                    </s-box>
                </>
            )}
            {!isThemeHasFrakButton && <ButtonNotActivated />}
        </s-box>
    );
}

function NoProduct() {
    const { t } = useTranslation();
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");

    return (
        <s-stack gap="small" alignItems="start">
            <s-text>{t("appearance.shareButton.noProduct")}</s-text>
            <ExternalLink
                href={`https://${rootData?.shop?.myshopifyDomain}/admin/products`}
            >
                {t("appearance.shareButton.noProductLink")}
            </ExternalLink>
        </s-stack>
    );
}

function ButtonNotActivated() {
    const { t } = useTranslation();
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const data = useLoaderData<typeof loader>();
    const firstProduct = data?.firstProduct;
    const editorUrl = `https://${rootData?.shop?.myshopifyDomain}/admin/themes/current/editor`;

    return (
        <Instructions
            badgeText={t("appearance.shareButton.notActivated")}
            todoText={t("appearance.shareButton.todo")}
            image={screenShareButton}
        >
            {firstProduct ? (
                <ExternalLink
                    href={`${editorUrl}?previewPath=/products/${firstProduct.handle}`}
                >
                    {t("appearance.shareButton.link")}
                </ExternalLink>
            ) : (
                <NoProduct />
            )}
        </Instructions>
    );
}
