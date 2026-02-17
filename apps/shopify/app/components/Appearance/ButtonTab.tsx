import type { loader as rootLoader } from "app/routes/app";
import type { loader } from "app/routes/app.appearance";
import { useTranslation } from "react-i18next";
import { useLoaderData, useRouteLoaderData } from "react-router";
import screenShareButton from "../../assets/share-button.png";
import { Activated } from "../Activated";
import { Instructions } from "../Instructions";

interface ButtonTabProps {
    isThemeHasFrakButton: boolean;
    firstProduct?: {
        handle: string;
    } | null;
}

export function ButtonTab({
    isThemeHasFrakButton,
    firstProduct,
}: ButtonTabProps) {
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const editorUrl = `https://${rootData?.shop.myshopifyDomain}/admin/themes/current/editor`;
    const { t } = useTranslation();

    return (
        <s-section>
            <s-box>
                {isThemeHasFrakButton && (
                    <>
                        <Activated
                            text={t("appearance.shareButton.activated")}
                        />
                        <s-box paddingBlockStart="small">
                            {firstProduct ? (
                                <s-link
                                    href={`${editorUrl}?previewPath=/products/${firstProduct.handle}`}
                                    target="_blank"
                                >
                                    {t("appearance.shareButton.link")}
                                </s-link>
                            ) : (
                                t("appearance.shareButton.noProduct")
                            )}
                        </s-box>
                    </>
                )}
                {!isThemeHasFrakButton && <ButtonNotActivated />}
            </s-box>
        </s-section>
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
                <s-link
                    href={`${editorUrl}?previewPath=/products/${firstProduct.handle}`}
                    target="_blank"
                >
                    {t("appearance.shareButton.link")}
                </s-link>
            ) : (
                t("appearance.shareButton.noProduct")
            )}
        </Instructions>
    );
}
