import { Button } from "@frak-labs/design-system/components/Button";
import { type ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { PasswordInput } from "@/module/common/component/PasswordInput";
import { WarningCard } from "@/module/common/component/WarningCard";
import { useTestRecoveryPassword } from "@/module/recovery-setup/hook/useTestRecoveryPassword";
import * as styles from "../SetupFlow/styles.css";

type PasswordStepProps = {
    onVerified: () => void;
    onBack: () => void;
    stepIndicator?: ReactNode;
};

export function PasswordStep({
    onVerified,
    onBack,
    stepIndicator,
}: PasswordStepProps) {
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
            title={t("wallet.recoverySetup.delete.password.title")}
            description={t("wallet.recoverySetup.delete.password.description")}
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
                    {t("wallet.recoverySetup.delete.password.continue")}
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
                    placeholder={t(
                        "wallet.recoverySetup.delete.password.placeholder"
                    )}
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
                <WarningCard>
                    {t("wallet.recoverySetup.delete.password.invalid")}
                </WarningCard>
            ) : null}
        </FlowStepScreen>
    );
}
