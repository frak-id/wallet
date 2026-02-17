import { DescriptionList } from "app/components/ui/DescriptionList";
import type { MerchantResolveResponse } from "app/services.server/merchant";
import { useTranslation } from "react-i18next";

export function ConnectedShopInfo({
    merchantInfo,
}: {
    merchantInfo: MerchantResolveResponse;
}) {
    const { t } = useTranslation();

    return (
        <s-section>
            <s-stack gap="base">
                <s-box paddingBlockEnd="small">
                    <s-stack
                        direction="inline"
                        justifyContent="space-between"
                        alignItems="center"
                    >
                        <s-heading>{t("status.connectedShop.title")}</s-heading>
                        <s-badge tone="success" icon="check">
                            {t("status.connected")}
                        </s-badge>
                    </s-stack>
                </s-box>

                <DescriptionList
                    items={[
                        {
                            term: t("status.connectedShop.merchantName"),
                            description: merchantInfo.name,
                        },
                        {
                            term: t("status.connectedShop.domain"),
                            description: merchantInfo.domain,
                        },
                        {
                            term: t("status.connectedShop.merchantId"),
                            description: merchantInfo.merchantId,
                        },
                    ]}
                />

                <s-box paddingBlockStart="small">
                    <s-text>{t("status.connectedShop.description")}</s-text>
                </s-box>
            </s-stack>
        </s-section>
    );
}
