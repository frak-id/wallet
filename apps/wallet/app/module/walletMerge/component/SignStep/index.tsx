import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Address, Hex } from "viem";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import type { SendAddPassKeyMutation } from "../../strategy/types";
import * as styles from "../stepLayout.css";

type SignStepProps = {
    winner: Address;
    winnerAuthenticatorId: string;
    winnerPublicKey: { x: Hex; y: Hex };
    loserAuthenticatorId: string;
    loserPublicKey: { x: Hex; y: Hex };
    /**
     * Called with the resulting tx hash once the user has authorised the
     * on-chain step. `undefined` is passed through when the addPassKey is
     * a no-op (loser cred already bound on-chain — idempotent retry path).
     */
    onSigned: (txHash?: Hex) => void;
    onCancel: () => void;
    /** addPassKey mutation provided by the active merge strategy. */
    sendAddPassKey: SendAddPassKeyMutation;
};

/**
 * Step that asks the user to authorise the final merge action. The
 * mutation is built by the active strategy with a transport selected from
 * `mode + needsSwitch` — same-device + cross-device-desktop-is-winner
 * sign locally; cross-device-desktop-is-loser routes signing through the
 * same origin pairing that ferried the consent assertion. The biometric
 * prompt the user sees is for the WINNER credential either way.
 */
export function SignStep({
    winner,
    winnerAuthenticatorId,
    winnerPublicKey,
    loserAuthenticatorId,
    loserPublicKey,
    onSigned,
    onCancel,
    sendAddPassKey,
}: SignStepProps) {
    const { t } = useTranslation();

    const onConfirm = useCallback(() => {
        sendAddPassKey.mutate(
            {
                winner,
                winnerAuthenticatorId,
                winnerPublicKey,
                loserAuthenticatorId,
                loserPublicKey,
            },
            {
                onSuccess: ({ txHash }) => onSigned(txHash),
            }
        );
    }, [
        sendAddPassKey,
        winner,
        winnerAuthenticatorId,
        winnerPublicKey,
        loserAuthenticatorId,
        loserPublicKey,
        onSigned,
    ]);

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
                        loading={sendAddPassKey.isPending}
                        disabled={sendAddPassKey.isPending}
                    >
                        {sendAddPassKey.isError
                            ? t("wallet.merge.sign.retry")
                            : t("wallet.merge.sign.authorise")}
                    </Button>
                    {sendAddPassKey.isError && (
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
                        {sendAddPassKey.isError
                            ? t("wallet.merge.sign.errorDescription")
                            : t("wallet.merge.sign.description")}
                    </Text>
                </Stack>

                {sendAddPassKey.isError && (
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
