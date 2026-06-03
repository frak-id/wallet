import { Button } from "@frak-labs/design-system/components/Button";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { type ReactNode, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { PasswordInput } from "@/module/common/component/PasswordInput";
import { WarningCard } from "@/module/common/component/WarningCard";
import {
    dateToValidAfter,
    dateToValidUntil,
    maxValidUntil,
} from "@/module/recovery-setup/utils/recoveryDates";
import * as styles from "./styles.css";

const MIN_PASSWORD_LENGTH = 8;

function toDateInputValue(date: Date): string {
    return date.toISOString().slice(0, 10);
}

type PasswordStepProps = {
    onSubmit: (params: {
        password: string;
        validAfter: number;
        validUntil: number;
    }) => void;
    onBack: () => void;
    stepIndicator?: ReactNode;
};

export function PasswordStep({
    onSubmit,
    onBack,
    stepIndicator,
}: PasswordStepProps) {
    const { t } = useTranslation();
    const formId = useId();
    const [password, setPassword] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const today = useMemo(() => toDateInputValue(new Date()), []);
    const maxDate = useMemo(
        () => toDateInputValue(new Date(maxValidUntil() * 1000)),
        []
    );

    const tooShort = password.length < MIN_PASSWORD_LENGTH;

    const handleSubmit = () => {
        if (tooShort) return;
        onSubmit({
            password,
            validAfter: dateToValidAfter(
                startDate ? new Date(startDate) : undefined
            ),
            validUntil: dateToValidUntil(
                endDate ? new Date(endDate) : undefined
            ),
        });
    };

    return (
        <FlowStepScreen
            fixedViewport
            title={t("wallet.recoverySetup.password.title")}
            description={t("wallet.recoverySetup.password.description")}
            onBack={onBack}
            stepIndicator={stepIndicator}
            footer={
                <Button
                    type="submit"
                    form={formId}
                    variant="primary"
                    size="large"
                    width="full"
                    disabled={tooShort}
                >
                    {t("wallet.recoverySetup.password.continue")}
                </Button>
            }
        >
            <form
                id={formId}
                className={styles.form}
                onSubmit={(event) => {
                    event.preventDefault();
                    handleSubmit();
                }}
            >
                <PasswordInput
                    label={t("wallet.recoverySetup.password.label")}
                    placeholder={t("wallet.recoverySetup.password.placeholder")}
                    hint={t("wallet.recoverySetup.password.hint", {
                        min: MIN_PASSWORD_LENGTH,
                    })}
                    toggleLabel={t("wallet.recoverySetup.password.toggle")}
                    autoComplete="new-password"
                    value={password}
                    onChange={setPassword}
                />

                <Stack space="xs">
                    <Text
                        as="label"
                        variant="bodySmall"
                        weight="medium"
                        color="secondary"
                    >
                        {t("wallet.recoverySetup.password.startLabel")}
                    </Text>
                    <Input
                        type="date"
                        variant="bare"
                        tone="muted"
                        length="big"
                        min={today}
                        max={maxDate}
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                    />
                    <Text variant="caption" color="tertiary">
                        {t("wallet.recoverySetup.password.startHelp")}
                    </Text>
                </Stack>

                <Stack space="xs">
                    <Text
                        as="label"
                        variant="bodySmall"
                        weight="medium"
                        color="secondary"
                    >
                        {t("wallet.recoverySetup.password.endLabel")}
                    </Text>
                    <Input
                        type="date"
                        variant="bare"
                        tone="muted"
                        length="big"
                        min={today}
                        max={maxDate}
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                    />
                    <Text variant="caption" color="tertiary">
                        {t("wallet.recoverySetup.password.endHelp")}
                    </Text>
                </Stack>
            </form>

            <WarningCard>
                {t("wallet.recoverySetup.password.warning")}
            </WarningCard>
        </FlowStepScreen>
    );
}
