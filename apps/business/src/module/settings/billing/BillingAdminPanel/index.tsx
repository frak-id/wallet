import { Inline } from "@frak-labs/design-system/components/Inline";
import { useTranslation } from "react-i18next";
import { useSettingsMerchantId } from "@/module/common/hook/useSettingsMerchantId";
import { SettingsCard } from "../../SettingsCard";
import { AddDepositSheet } from "../AddDepositSheet";
import { AddWithdrawSheet } from "../AddWithdrawSheet";
import { useBillingInfo } from "../useBillingInfo";

/**
 * Platform-admin-only section: create deposit notes / withdraw bills for the
 * active merchant (billing-feature-plan.md §5, admin-only routes). Rendered
 * by `BillingTab` gated on `useMyMerchants().isPlatformAdmin` — this
 * component itself does not re-check the flag, so it must never be rendered
 * unconditionally by a caller.
 */
export function BillingAdminPanel() {
    const { t } = useTranslation();
    const merchantId = useSettingsMerchantId();
    const { info } = useBillingInfo();

    if (!merchantId) return null;

    return (
        <SettingsCard
            emphasis="section"
            title={t("settings.billing.admin.panel.title")}
            description={t("settings.billing.admin.panel.description")}
        >
            <Inline space="s">
                <AddDepositSheet
                    merchantId={merchantId}
                    defaultCountry={info?.country}
                />
                <AddWithdrawSheet merchantId={merchantId} />
            </Inline>
        </SettingsCard>
    );
}
