import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { maxValidUntil } from "@/module/recovery-setup/utils/recoveryDates";

function toDateInputValue(date: Date): string {
    return date.toISOString().slice(0, 10);
}

/** Default range for the date-only refresh: usable from now, expiring in two years. */
export function defaultRefreshDateRange(): { start: string; end: string } {
    return {
        start: toDateInputValue(new Date()),
        end: toDateInputValue(new Date(maxValidUntil() * 1000)),
    };
}

type ValidityDateFieldsProps = {
    startDate: string;
    endDate: string;
    onStartChange: (value: string) => void;
    onEndChange: (value: string) => void;
    errorMessage?: string;
};

/**
 * The "usable from / expires" date pair shared by recovery setup (PasswordStep)
 * and the date-only refresh (DatesStep). Both inputs are bounded to [today, +2y].
 */
export function ValidityDateFields({
    startDate,
    endDate,
    onStartChange,
    onEndChange,
    errorMessage,
}: ValidityDateFieldsProps) {
    const { t } = useTranslation();
    const id = useId();
    const today = useMemo(() => toDateInputValue(new Date()), []);
    const maxDate = useMemo(
        () => toDateInputValue(new Date(maxValidUntil() * 1000)),
        []
    );

    return (
        <>
            <Stack space="xs">
                <Text
                    as="label"
                    htmlFor={`${id}-start`}
                    variant="bodySmall"
                    weight="medium"
                    color="secondary"
                >
                    {t("wallet.recoverySetup.password.startLabel")}
                </Text>
                <Input
                    id={`${id}-start`}
                    aria-describedby={`${id}-start-help`}
                    type="date"
                    variant="bare"
                    tone="muted"
                    length="big"
                    min={today}
                    max={endDate || maxDate}
                    value={startDate}
                    onChange={(event) => onStartChange(event.target.value)}
                />
                <Text
                    id={`${id}-start-help`}
                    variant="caption"
                    color="tertiary"
                >
                    {t("wallet.recoverySetup.password.startHelp")}
                </Text>
            </Stack>

            <Stack space="xs">
                <Text
                    as="label"
                    htmlFor={`${id}-end`}
                    variant="bodySmall"
                    weight="medium"
                    color="secondary"
                >
                    {t("wallet.recoverySetup.password.endLabel")}
                </Text>
                <Input
                    id={`${id}-end`}
                    aria-describedby={`${id}-end-help`}
                    type="date"
                    variant="bare"
                    tone="muted"
                    length="big"
                    min={startDate || today}
                    max={maxDate}
                    value={endDate}
                    onChange={(event) => onEndChange(event.target.value)}
                />
                <Text id={`${id}-end-help`} variant="caption" color="tertiary">
                    {t("wallet.recoverySetup.password.endHelp")}
                </Text>
            </Stack>

            {errorMessage ? (
                <Text variant="caption" color="error">
                    {errorMessage}
                </Text>
            ) : null}
        </>
    );
}
