import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { type ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Address, LocalAccount } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { PasswordInput } from "@/module/common/component/PasswordInput";
import { WarningCard } from "@/module/common/component/WarningCard";
import { decodeRecoveryBlob } from "@/module/recovery-setup/utils/recoveryBlob";
import * as styles from "./styles.css";
import { TryExistingPasskey } from "./TryExistingPasskey";

type PasswordStepProps = {
    blob: string;
    onUnlocked: (
        walletAddress: Address,
        guardianAccount: LocalAccount<string>
    ) => void;
    onBack: () => void;
    stepIndicator?: ReactNode;
};

export function PasswordStep({
    blob,
    onUnlocked,
    onBack,
    stepIndicator,
}: PasswordStepProps) {
    const { t } = useTranslation();
    const formId = useId();
    const [password, setPassword] = useState("");
    const [failed, setFailed] = useState(false);
    const [isPending, setIsPending] = useState(false);

    const handleSubmit = async () => {
        setIsPending(true);
        const content = await decodeRecoveryBlob({ blob, password });
        setIsPending(false);
        if (!content) {
            setFailed(true);
            return;
        }
        onUnlocked(
            content.smartWalletAddress,
            privateKeyToAccount(content.burnerPrivateKey)
        );
    };

    return (
        <FlowStepScreen
            title={t("wallet.recoveryUsage.password.title")}
            description={t("wallet.recoveryUsage.password.description")}
            onBack={onBack}
            backDisabled={isPending}
            stepIndicator={stepIndicator}
            footer={
                <Stack space="s">
                    <Button
                        type="submit"
                        form={formId}
                        variant="primary"
                        size="large"
                        width="full"
                        loading={isPending}
                        disabled={isPending || password.length === 0}
                    >
                        {t("wallet.recoveryUsage.password.continue")}
                    </Button>
                    <TryExistingPasskey />
                </Stack>
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
                    placeholder={t("wallet.recoveryUsage.password.placeholder")}
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
                    {t("wallet.recoveryUsage.password.invalid")}
                </WarningCard>
            ) : null}
        </FlowStepScreen>
    );
}
