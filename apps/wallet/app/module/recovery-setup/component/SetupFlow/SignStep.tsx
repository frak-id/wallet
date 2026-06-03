import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { selectWebauthnSession, sessionStore } from "@frak-labs/wallet-shared";
import { tryit } from "radash";
import { type ReactNode, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Back } from "@/module/common/component/Back";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import { useGenerateRecoveryOptions } from "@/module/recovery-setup/hook/useGenerateRecoveryOptions";
import { useSetupRecovery } from "@/module/recovery-setup/hook/useSetupRecovery";
import * as styles from "./styles.css";

type SignStepProps = {
    password: string;
    validAfter: number;
    validUntil: number;
    /** Called with the encrypted backup blob once the on-chain tx lands. */
    onSigned: (blob: string) => void;
    onBack: () => void;
    stepIndicator?: ReactNode;
};

export function SignStep({
    password,
    validAfter,
    validUntil,
    onSigned,
    onBack,
    stepIndicator,
}: SignStepProps) {
    const { t } = useTranslation();
    const session = useStore(sessionStore, selectWebauthnSession);
    const { generateRecoveryOptionsAsync, isPending: isGenerating } =
        useGenerateRecoveryOptions();
    const { setupRecoveryAsync, isPending: isSettingUp } = useSetupRecovery();
    const [isError, setIsError] = useState(false);

    const isPending = isGenerating || isSettingUp;

    const handleConfirm = useCallback(async () => {
        if (!session) return;
        setIsError(false);

        const [error, blob] = await tryit(async () => {
            const { setupTxData, blob: generatedBlob } =
                await generateRecoveryOptionsAsync({
                    wallet: session,
                    password,
                    validAfter,
                    validUntil,
                });
            await setupRecoveryAsync({ setupTxData });
            return generatedBlob;
        })();

        if (error || !blob) {
            setIsError(true);
            return;
        }
        onSigned(blob);
    }, [
        session,
        password,
        validAfter,
        validUntil,
        generateRecoveryOptionsAsync,
        setupRecoveryAsync,
        onSigned,
    ]);

    return (
        <PageLayout
            back={<Back onClick={onBack} disabled={isPending} />}
            headerCenter={stepIndicator}
            footer={
                <Box className={styles.footer}>
                    <Button
                        type="button"
                        variant="primary"
                        size="large"
                        width="full"
                        onClick={handleConfirm}
                        loading={isPending}
                        disabled={isPending}
                    >
                        {isError
                            ? t("wallet.recoverySetup.sign.retry")
                            : t("wallet.recoverySetup.sign.authorise")}
                    </Button>
                </Box>
            }
        >
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">
                        {t("wallet.recoverySetup.sign.title")}
                    </Title>
                    <Text variant="body" color="secondary">
                        {isError
                            ? t("wallet.recoverySetup.sign.errorDescription")
                            : t("wallet.recoverySetup.sign.description")}
                    </Text>
                </Stack>

                {isError && (
                    <Card variant="muted" padding="default">
                        <Text variant="bodySmall" color="error">
                            {t("wallet.recoverySetup.sign.error")}
                        </Text>
                    </Card>
                )}
            </Stack>
        </PageLayout>
    );
}
