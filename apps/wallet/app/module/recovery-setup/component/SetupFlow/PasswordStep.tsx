import { Button } from "@frak-labs/design-system/components/Button";
import { type ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { PasswordInput } from "@/module/common/component/PasswordInput";
import { WarningCard } from "@/module/common/component/WarningCard";
import { ValidityDateFields } from "@/module/recovery-setup/component/ValidityDateFields";
import {
    dateToValidAfter,
    dateToValidUntil,
} from "@/module/recovery-setup/utils/recoveryDates";
import type { RecoveryFlowMode } from "./index";
import * as styles from "./styles.css";

const MIN_PASSWORD_LENGTH = 8;

type PasswordStepProps = {
    mode: RecoveryFlowMode;
    onSubmit: (params: {
        password: string;
        validAfter: number;
        validUntil: number;
    }) => void;
    onBack: () => void;
    stepIndicator?: ReactNode;
};

export function PasswordStep({
    mode,
    onSubmit,
    onBack,
    stepIndicator,
}: PasswordStepProps) {
    const { t } = useTranslation();
    const formId = useId();
    const [password, setPassword] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

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
            {mode === "refresh" ? (
                <WarningCard>
                    {t("wallet.recoverySetup.refresh.replaceNote")}
                </WarningCard>
            ) : null}

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

                <ValidityDateFields
                    startDate={startDate}
                    endDate={endDate}
                    onStartChange={setStartDate}
                    onEndChange={setEndDate}
                />
            </form>

            <WarningCard>
                {t("wallet.recoverySetup.password.warning")}
            </WarningCard>
        </FlowStepScreen>
    );
}
