import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { Back } from "@/module/common/component/Back";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import { useSwitchAuthenticator } from "../../hook/useSwitchAuthenticator";
import { shortenAddress } from "../../utils/shortenAddress";
import * as styles from "./index.css";

type SwitchStepProps = {
    /** Wallet of the credential we're about to switch the live session to. */
    winnerWallet: Address;
    /** Credential id we'll log in as. */
    winnerAuthenticatorId: string;
    /** Called once the session has been swapped to the winner. */
    onSwitched: () => void;
    onBack: () => void;
};

/**
 * Explicit step where the user logs in as the other account so the next
 * confirmation can come from that account's context. Kept as its own screen
 * so the user understands they're about to be prompted for a different
 * passkey — without this beat, the three back-to-back prompts feel like a
 * single broken flow.
 */
export function SwitchStep({
    winnerWallet,
    winnerAuthenticatorId,
    onSwitched,
    onBack,
}: SwitchStepProps) {
    const { t } = useTranslation();
    const switchAuth = useSwitchAuthenticator();

    const short = shortenAddress(winnerWallet);

    const onConfirm = useCallback(() => {
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
                        onClick={onConfirm}
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
