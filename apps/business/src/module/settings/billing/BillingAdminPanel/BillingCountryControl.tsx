import { Inline } from "@frak-labs/design-system/components/Inline";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { COUNTRIES } from "@/module/common/utils/countries";
import { useUpdateBillingCountry } from "../useBillingAdmin";

export function BillingCountryControl({
    merchantId,
    currentCountry,
}: {
    merchantId: string;
    currentCountry?: string;
}) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState<string | null>(null);
    const {
        mutate: updateCountry,
        isPending,
        isError,
    } = useUpdateBillingCountry(merchantId);

    const selected = draft ?? currentCountry ?? "";
    const isDirty = selected !== "" && selected !== (currentCountry ?? "");

    return (
        <Stack space="xs">
            <Text variant="bodySmall" weight="medium" color="secondary">
                {t("settings.billing.admin.country.label")}
            </Text>
            <Inline space="s" alignY="center">
                <Select value={selected} onValueChange={setDraft}>
                    <SelectTrigger length="medium">
                        <SelectValue
                            placeholder={t(
                                "settings.billing.fields.country.placeholder"
                            )}
                        />
                    </SelectTrigger>
                    <SelectContent>
                        {COUNTRIES.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                                {country.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    variant="secondary"
                    size="small"
                    disabled={!isDirty || isPending}
                    loading={isPending}
                    onClick={() =>
                        updateCountry(selected, {
                            onSuccess: () => setDraft(null),
                        })
                    }
                >
                    {t("settings.billing.admin.country.save")}
                </Button>
            </Inline>
            <Text variant="caption" color={isError ? "error" : "tertiary"}>
                {isError
                    ? t("settings.billing.admin.country.error")
                    : t("settings.billing.admin.country.hint")}
            </Text>
        </Stack>
    );
}
