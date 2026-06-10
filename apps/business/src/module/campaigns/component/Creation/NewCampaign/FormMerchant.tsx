import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import { campaignStore } from "@/stores/campaignStore";
import { WizardFieldCard } from "../WizardFieldCard";
import * as styles from "./basics.css";

/**
 * Merchant selector for step 0. Routes are merchant-scoped, so switching
 * merchant resets the draft and navigates to the new merchant's blank
 * campaign rather than mutating the current one.
 */
export function FormMerchant({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { merchants } = useMyMerchants();
    const resetDraft = campaignStore((s) => s.reset);
    const selectedMerchant = merchants.find((m) => m.id === merchantId);

    function handleChange(nextMerchantId: string) {
        if (nextMerchantId === merchantId) return;
        resetDraft();
        navigate({
            to: "/m/$merchantId/campaigns/draft/new",
            params: { merchantId: nextMerchantId },
        });
    }

    return (
        <WizardFieldCard
            insetLabel
            space="xs"
            label={t("campaigns.create.basics.merchant.label")}
        >
            <Select
                value={merchantId || undefined}
                onValueChange={handleChange}
            >
                <SelectTrigger className={styles.selectTrigger}>
                    {/* Closed trigger shows the domain only; items keep "name — domain". */}
                    <SelectValue
                        placeholder={t(
                            "campaigns.create.basics.merchant.placeholder"
                        )}
                    >
                        {selectedMerchant?.domain}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {merchants.map((merchant) => (
                        <SelectItem key={merchant.id} value={merchant.id}>
                            {merchant.name} — {merchant.domain}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </WizardFieldCard>
    );
}
