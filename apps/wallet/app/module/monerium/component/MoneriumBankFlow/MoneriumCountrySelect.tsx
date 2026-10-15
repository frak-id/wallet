import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FieldError, FieldLabel } from "@/module/common/component/Field";
import { getCountryOptions } from "@/module/monerium/utils/countries";

type MoneriumCountrySelectProps = {
    value: string;
    onChange: (code: string) => void;
    invalid: boolean;
};

export function MoneriumCountrySelect({
    value,
    onChange,
    invalid,
}: MoneriumCountrySelectProps) {
    const { t, i18n } = useTranslation();
    const errorId = useId();
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
                    aria-invalid={invalid}
                    aria-describedby={invalid ? errorId : undefined}
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
            {invalid ? (
                <div id={errorId} role="alert">
                    <FieldError>
                        {t(
                            "monerium.bankFlow.transfer.ibanManager.countryInvalid"
                        )}
                    </FieldError>
                </div>
            ) : null}
        </Stack>
    );
}
