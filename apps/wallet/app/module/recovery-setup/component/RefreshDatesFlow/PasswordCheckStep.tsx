import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { type ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { PasswordInput } from "@/module/common/component/PasswordInput";
import { WarningCard } from "@/module/common/component/WarningCard";
import { useTestRecoveryPassword } from "@/module/recovery-setup/hook/useTestRecoveryPassword";
import * as styles from "../SetupFlow/styles.css";

type PasswordCheckStepProps = {
    /** The password decrypted the stored blob — the kept burner is still usable. */
    onVerified: () => void;
    /** Switch to minting a fresh key (offered after a wrong password). */
    onReplaceKey: () => void;
    onBack: () => void;
    stepIndicator?: ReactNode;
};

export function PasswordCheckStep({
    onVerified,
    onReplaceKey,
    onBack,
    stepIndicator,
}: PasswordCheckStepProps) {
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
            title={t("wallet.recoverySetup.dates.password.title")}
            description={t("wallet.recoverySetup.dates.password.description")}
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
                    {t("wallet.recoverySetup.dates.password.continue")}
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
                        "wallet.recoverySetup.dates.password.placeholder"
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
                <Stack space="s">
                    <WarningCard>
                        {t("wallet.recoverySetup.dates.password.invalid")}
                    </WarningCard>
                    <Button
                        type="button"
                        variant="secondary"
                        size="large"
                        width="full"
                        onClick={onReplaceKey}
                    >
                        {t("wallet.recoverySetup.dates.password.replaceAction")}
                    </Button>
                </Stack>
            ) : null}
        </FlowStepScreen>
    );
}
