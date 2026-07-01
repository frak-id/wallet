import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { PasswordInput } from "@/module/common/component/PasswordInput";
import { useTestRecoveryPassword } from "@/module/recovery-setup/hook/useTestRecoveryPassword";
import * as formStyles from "../SetupFlow/styles.css";

type VerifyPasswordFlowProps = {
    onBack: () => void;
};

/**
 * Standalone self-check screen reached from the recovery configuration:
 * confirm the user still remembers their recovery password by decrypting the
 * stored backup on-device. Read-only — it never mutates anything, just reports
 * whether the password matches.
 */
export function VerifyPasswordFlow({ onBack }: VerifyPasswordFlowProps) {
    const { t } = useTranslation();
    const formId = useId();
    const { testPasswordAsync, isPending } = useTestRecoveryPassword();
    const [password, setPassword] = useState("");
    const [result, setResult] = useState<"valid" | "invalid" | null>(null);

    const handleTest = async () => {
        setResult(null);
        const valid = await testPasswordAsync({ password });
        setResult(valid ? "valid" : "invalid");
    };

    return (
        <FlowStepScreen
            title={t("wallet.recoverySetup.config.testTitle")}
            description={t("wallet.recoverySetup.config.testDescription")}
            onBack={onBack}
            backDisabled={isPending}
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
                    {t("wallet.recoverySetup.config.testButton")}
                </Button>
            }
        >
            <form
                id={formId}
                className={formStyles.form}
                onSubmit={(event) => {
                    event.preventDefault();
                    handleTest();
                }}
            >
                <PasswordInput
                    toggleLabel={t("wallet.recoverySetup.password.toggle")}
                    placeholder={t(
                        "wallet.recoverySetup.config.testPlaceholder"
                    )}
                    autoComplete="off"
                    value={password}
                    error={result === "invalid"}
                    onChange={(value) => {
                        setPassword(value);
                        setResult(null);
                    }}
                />
            </form>

            {result === "valid" && (
                <Text variant="bodySmall" color="secondary">
                    {t("wallet.recoverySetup.config.testValid")}
                </Text>
            )}
            {result === "invalid" && (
                <Text variant="bodySmall" color="error">
                    {t("wallet.recoverySetup.config.testInvalid")}
                </Text>
            )}
        </FlowStepScreen>
    );
}
