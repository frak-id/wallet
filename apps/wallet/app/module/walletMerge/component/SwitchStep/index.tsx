import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { Back } from "@/module/common/component/Back";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import type {
    MergeStrategy,
    SwitchToWinnerMutation,
} from "../../strategy/types";
import { shortenAddress } from "../../utils/shortenAddress";
import { RemotePairingPanel } from "../RemotePairingPanel";
import * as styles from "../stepLayout.css";

type SwitchStepProps = {
    /** Wallet of the credential we're about to switch the live session to. */
    winnerWallet: Address;
    /** Credential id we'll log in as. */
    winnerAuthenticatorId: string;
    /** Called once the session has been swapped to the winner. */
    onSwitched: () => void;
    onBack: () => void;
    /** Switch-to-winner mutation provided by the active merge strategy. */
    switchAuth: SwitchToWinnerMutation;
    strategy: MergeStrategy;
};

/**
 * Explicit step where the user moves the live session to the winner so the
 * next confirmation can come from that wallet's smart-account context.
 *
 *  - Local mode: `useSwitchAuthenticator` triggers a fresh biometric login
 *    on this device. Kept as its own screen so the user understands they
 *    are about to be prompted for a *different* passkey — without this
 *    beat, the three back-to-back prompts feel like a single broken flow.
 *  - Remote mode: the strategy mutation drives a pairing handshake whose
 *    `authenticated` event swaps the live session for a distant-webauthn
 *    one. The step renders the QR + status while waiting for the mobile
 *    to scan + authenticate. Auto-advances to SignStep on success — wagmi
 *    then routes the on-chain step through the pairing automatically.
 */
export function SwitchStep({
    winnerWallet,
    winnerAuthenticatorId,
    onSwitched,
    onBack,
    switchAuth,
    strategy,
}: SwitchStepProps) {
    const { t } = useTranslation();
    const startedRef = useRef(false);
    const short = shortenAddress(winnerWallet);

    const runMutation = useCallback(() => {
        switchAuth.mutate(
            {
                wallet: winnerWallet,
                authenticatorId: winnerAuthenticatorId,
            },
            {
                onSuccess: () => onSwitched(),
            }
        );
    }, [switchAuth, winnerWallet, winnerAuthenticatorId, onSwitched]);

    // Remote switch is driven by a paired device — there's nothing for the
    // user to click locally, so auto-kick the mutation on mount. Local
    // switch still waits for explicit confirmation.
    useEffect(() => {
        if (strategy.mode !== "remote") return;
        if (startedRef.current) return;
        startedRef.current = true;
        runMutation();
    }, [strategy.mode, runMutation]);

    if (strategy.mode === "remote") {
        return (
            <RemoteSwitchBody
                strategy={strategy}
                isError={switchAuth.isError}
                onRetry={() => {
                    startedRef.current = false;
                    switchAuth.reset();
                    strategy.remote?.onRetry();
                    startedRef.current = true;
                    runMutation();
                }}
                onBack={onBack}
            />
        );
    }

    return (
        <PageLayout
            back={<Back onClick={onBack} />}
            footer={
                <Box className={styles.footer}>
                    <Button
                        type="button"
                        variant="primary"
                        size="large"
                        width="full"
                        onClick={runMutation}
                        loading={switchAuth.isPending}
                        disabled={switchAuth.isPending}
                    >
                        {switchAuth.isError
                            ? t("wallet.merge.switch.retry")
                            : t("wallet.merge.switch.confirm", {
                                  wallet: short,
                              })}
                    </Button>
                </Box>
            }
        >
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">{t("wallet.merge.switch.title")}</Title>
                    <Text variant="body" color="secondary">
                        {t("wallet.merge.switch.description", {
                            wallet: short,
                        })}
                    </Text>
                </Stack>

                <Card variant="muted" padding="default">
                    <Stack space="xs">
                        <Text variant="bodySmall" weight="semiBold">
                            {t("wallet.merge.switch.help.title")}
                        </Text>
                        <Text variant="bodySmall" color="secondary">
                            {t("wallet.merge.switch.help.description")}
                        </Text>
                    </Stack>
                </Card>

                {switchAuth.isError && (
                    <Card variant="muted" padding="default">
                        <Text variant="bodySmall" color="error">
                            {t("wallet.merge.switch.error")}
                        </Text>
                    </Card>
                )}
            </Stack>
        </PageLayout>
    );
}

function RemoteSwitchBody(props: {
    strategy: MergeStrategy;
    isError: boolean;
    onRetry: () => void;
    onBack: () => void;
}) {
    return (
        <RemotePairingPanel
            {...props}
            i18nKeys={{
                title: "wallet.merge.switch.remote.title",
                description: "wallet.merge.switch.remote.description",
                preparing: "wallet.merge.switch.remote.preparing",
                error: "wallet.merge.switch.remote.error",
                retry: "wallet.merge.switch.retry",
            }}
        />
    );
}
