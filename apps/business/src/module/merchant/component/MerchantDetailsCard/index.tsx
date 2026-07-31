import { Inline } from "@frak-labs/design-system/components/Inline";
import { useTranslation } from "react-i18next";
import { EditCard } from "@/module/common/component/EditCard";
import { currencyMetadata } from "@/module/common/utils/currencyOptions";
import { detectStablecoinFromAddress } from "@/module/common/utils/stablecoin";
import {
    DetailCell,
    DetailCells,
} from "@/module/merchant/component/DetailCell";
import { MerchantEditSheet } from "@/module/merchant/component/MerchantEditSheet";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import { useReadOnlyMerchant } from "@/module/merchant/hook/useReadOnlyMerchant";

/**
 * Read-only summary of the merchant's core identity (name, domain, reward
 * currency) with the edit sheet trigger. Sits at the top of the Identity
 * tab, and of the Affiliate tab for merchants without an embedded SDK.
 */
export function MerchantDetailsCard({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
    const { data: merchant } = useMerchant({ merchantId });
    const isReadOnly = useReadOnlyMerchant({ merchantId });

    if (!merchant) return null;

    const stablecoin =
        detectStablecoinFromAddress(merchant.defaultRewardToken) ?? "eure";
    const currency = currencyMetadata[stablecoin];

    return (
        <EditCard title={t("merchantEdit.details.title")}>
            <DetailCells>
                <DetailCell
                    label={t("merchantEdit.details.name")}
                    value={merchant.name}
                />
                <DetailCell
                    label={t("merchantEdit.details.domain")}
                    value={merchant.domain}
                />
                <DetailCell
                    label={t("merchantEdit.details.currency")}
                    value={currency ? currency.label : "—"}
                />
            </DetailCells>
            {!isReadOnly && (
                <Inline space="s">
                    <MerchantEditSheet
                        merchant={merchant}
                        merchantId={merchantId}
                    />
                </Inline>
            )}
        </EditCard>
    );
}
