import { Card } from "@frak-labs/design-system/components/Card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import { campaignStore } from "@/stores/campaignStore";
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

    function handleChange(nextMerchantId: string) {
        if (nextMerchantId === merchantId) return;
        resetDraft();
        navigate({
            to: "/m/$merchantId/campaigns/draft/new",
            params: { merchantId: nextMerchantId },
        });
    }

    return (
        <Card radius="m">
            <Stack space="m">
                <Text
                    variant="bodySmall"
                    weight="medium"
                    color="secondary"
                    className={styles.fieldLabel}
                >
                    {t("campaigns.create.basics.merchant.label")}
                </Text>
                <Select
                    value={merchantId || undefined}
                    onValueChange={handleChange}
                >
                    <SelectTrigger className={styles.selectTrigger}>
                        <SelectValue
                            placeholder={t(
                                "campaigns.create.basics.merchant.placeholder"
                            )}
                        />
                    </SelectTrigger>
                    <SelectContent>
                        {merchants.map((merchant) => (
                            <SelectItem key={merchant.id} value={merchant.id}>
                                {merchant.name} — {merchant.domain}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </Stack>
        </Card>
    );
}
