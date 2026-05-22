import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Hex } from "viem";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import { useSendAddPassKeyTx } from "../../hook/useSendAddPassKeyTx";
import * as styles from "./index.css";

type SignStepProps = {
    loserAuthenticatorId: string;
    loserPublicKey: { x: Hex; y: Hex };
    /**
     * Called with the resulting tx hash once the user has authorised the
     * on-chain step. The hash is then handed to the settling step so a
     * follow-up failure can retry settlement without re-prompting.
     */
    onSigned: (txHash?: Hex) => void;
    onCancel: () => void;
};

/**
 * Step that asks the user to authorise the final merge action. The on-chain
 * mechanics are hidden — the screen only frames it as a confirmation that
 * brings everything together. Re-using the existing wagmi `useSendTransaction`
 * means the prompt is signed by whichever credential the previous SwitchStep
 * has placed in the live session.
 */
export function SignStep({
    loserAuthenticatorId,
    loserPublicKey,
    onSigned,
    onCancel,
}: SignStepProps) {
    const { t } = useTranslation();
    const sendTx = useSendAddPassKeyTx();

    const onConfirm = useCallback(() => {
        sendTx.mutate(
            { loserAuthenticatorId, loserPublicKey },
            {
                onSuccess: (txHash) => onSigned(txHash ?? undefined),
            }
        );
    }, [sendTx, loserAuthenticatorId, loserPublicKey, onSigned]);

    return (
        <PageLayout
            footer={
                <Box className={styles.footer}>
                    <Button
                        type="button"
                        variant="primary"
                        size="large"
                        width="full"
                        onClick={onConfirm}
                        loading={sendTx.isPending}
                        disabled={sendTx.isPending}
                    >
                        {sendTx.isError
                            ? t("wallet.merge.sign.retry")
                            : t("wallet.merge.sign.authorise")}
                    </Button>
                    {sendTx.isError && (
                        <Button
                            type="button"
                            variant="secondary"
                            size="large"
                            width="full"
                            onClick={onCancel}
                        >
                            {t("wallet.merge.sign.cancel")}
                        </Button>
                    )}
                </Box>
            }
        >
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">{t("wallet.merge.sign.title")}</Title>
                    <Text variant="body" color="secondary">
                        {sendTx.isError
                            ? t("wallet.merge.sign.errorDescription")
                            : t("wallet.merge.sign.description")}
                    </Text>
                </Stack>

                {sendTx.isError && (
                    <Card variant="muted" padding="default">
                        <Text variant="bodySmall" color="error">
                            {t("wallet.merge.sign.error")}
                        </Text>
                    </Card>
                )}
            </Stack>
        </PageLayout>
    );
}
