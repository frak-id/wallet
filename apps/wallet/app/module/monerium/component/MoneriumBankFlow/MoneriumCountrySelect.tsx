import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FieldLabel } from "@/module/common/component/Field";
import { getCountryOptions } from "@/module/monerium/utils/countries";

type MoneriumCountrySelectProps = {
    value: string;
    onChange: (code: string) => void;
};

export function MoneriumCountrySelect({
    value,
    onChange,
}: MoneriumCountrySelectProps) {
    const { t, i18n } = useTranslation();
    const options = useMemo(
        () => getCountryOptions(i18n.language),
        [i18n.language]
    );
    const label = t("monerium.bankFlow.transfer.ibanManager.countryLabel");

    return (
        <Stack space="xs">
            <FieldLabel>{label}</FieldLabel>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger
                    variant="bare"
                    tone="elevated"
                    aria-label={label}
                >
                    <SelectValue
                        placeholder={t(
                            "monerium.bankFlow.transfer.ibanManager.countryPlaceholder"
                        )}
                    />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.code} value={option.code}>
                            {option.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </Stack>
    );
}
