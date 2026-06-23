import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { type ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { PasswordInput } from "@/module/common/component/PasswordInput";
import { WarningCard } from "@/module/common/component/WarningCard";
import { useTestRecoveryPassword } from "@/module/recovery-setup/hook/useTestRecoveryPassword";
import * as styles from "../SetupFlow/styles.css";

type RecoveryPasswordGateProps = {
    title: string;
    description: string;
    placeholder: string;
    continueLabel: string;
    invalidMessage: string;
    onVerified: () => void;
    onBack: () => void;
    stepIndicator?: ReactNode;
    /** Extra content shown under the invalid warning (e.g. a replace-key CTA). */
    failureExtra?: ReactNode;
};

/**
 * Password confirmation gate shared by the delete and date-refresh flows:
 * fetch the stored blob and verify the password by decrypting it on-device.
 */
export function RecoveryPasswordGate({
    title,
    description,
    placeholder,
    continueLabel,
    invalidMessage,
    onVerified,
    onBack,
    stepIndicator,
    failureExtra,
}: RecoveryPasswordGateProps) {
    const { t } = useTranslation();
    const formId = useId();
    const { testPasswordAsync, isPending } = useTestRecoveryPassword();
    const [password, setPassword] = useState("");
    const [failed, setFailed] = useState(false);

    const handleSubmit = async () => {
        const valid = await testPasswordAsync({ password });
        if (valid) {
            onVerified();
            return;
        }
        setFailed(true);
    };

    return (
        <FlowStepScreen
            title={title}
            description={description}
            onBack={onBack}
            backDisabled={isPending}
            stepIndicator={stepIndicator}
            footer={
                <Button
                    type="submit"
                    form={formId}
                    variant="primary"
                    size="large"
                    width="full"
                    loading={isPending}
                    disabled={isPending || password.length === 0}
                >
                    {continueLabel}
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
                    toggleLabel={t("wallet.recoverySetup.password.toggle")}
                    placeholder={placeholder}
                    autoComplete="off"
                    value={password}
                    error={failed}
                    onChange={(value) => {
                        setPassword(value);
                        setFailed(false);
                    }}
                />
            </form>

            {failed ? (
                <Stack space="s">
                    <WarningCard>{invalidMessage}</WarningCard>
                    {failureExtra}
                </Stack>
            ) : null}
        </FlowStepScreen>
    );
}
