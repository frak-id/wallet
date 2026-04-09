import type { loader as rootLoader } from "app/routes/app";
import { useTranslation } from "react-i18next";
import { useRouteLoaderData } from "react-router";
import { ExternalLink } from "../ui/ExternalLink";

export function CheckoutExtensionTab() {
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const checkoutEditorUrl = `https://${rootData?.shop?.myshopifyDomain}/admin/settings/checkout/editor?page=thank-you&context=apps`;
    const { t } = useTranslation();

    return (
        <s-section>
            <s-box>
                <s-stack gap="base">
                    <s-text>
                        {t("appearance.checkoutExtension.description")}
                    </s-text>
                    <ExternalLink href={checkoutEditorUrl}>
                        {t("appearance.checkoutExtension.link")}
                    </ExternalLink>
                </s-stack>
            </s-box>
        </s-section>
    );
}
