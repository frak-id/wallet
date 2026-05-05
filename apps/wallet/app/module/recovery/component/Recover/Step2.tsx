import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { recordError, useLogin } from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { toHex } from "viem";
import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import {
    recoveryStore,
    selectRecoveryFileContent,
} from "@/module/stores/recoveryStore";
import * as styles from "./Step2.css";

const ACTUAL_STEP = 2;

export function Step2() {
    const { t } = useTranslation();
    // Get the recovery file
    const fileContent = recoveryStore(selectRecoveryFileContent);

    const navigate = useNavigate();
    const [, startTransition] = useTransition();

    // Get the login function in case passkey is still on device
    const { login, isLoading } = useLogin();

    const triggerContinueRecovery = useCallback(async () => {
        if (
            !fileContent?.initialWallet?.address ||
            !fileContent?.initialWallet?.authenticatorId
        )
            return;

        try {
            const wallet = await login({
                lastAuthentication: {
                    wallet: fileContent?.initialWallet?.address,
                    authenticatorId:
                        fileContent?.initialWallet?.authenticatorId,
                },
            });

            // If no wallet, go to the next step
            if (!wallet) recoveryStore.getState().setStep(ACTUAL_STEP + 1);

            // If login is in success, go to the wallet
            if (wallet) {
                startTransition(() => {
                    navigate({ to: "/wallet", viewTransition: true });
                });
            }
        } catch (e) {
            recordError(e, { source: "recovery", context: { step: 2 } });
            recoveryStore.getState().setStep(ACTUAL_STEP + 1);
        }
    }, [fileContent, login, navigate]);

    return (
        <AccordionRecoveryItem
            actualStep={ACTUAL_STEP}
            title={t("wallet.recovery.step2")}
        >
            <Stack space="xs">
                <Box>
                    <Text as="span">{t("common.walletAddress")} </Text>
                    <Text as="span" className={styles.addressValue}>
                        {fileContent?.initialWallet?.address ?? "0x"}
                    </Text>
                </Box>
                <Box>
                    <Text as="span">{t("common.authenticator")} </Text>
                    <Text as="span" className={styles.addressValue}>
                        {toHex(
                            fileContent?.initialWallet?.authenticatorId ?? "0"
                        )}
                    </Text>
                </Box>
                <Button
                    className={styles.button}
                    disabled={isLoading}
                    onClick={triggerContinueRecovery}
                >
                    {t("wallet.recovery.continue")}
                </Button>
            </Stack>
        </AccordionRecoveryItem>
    );
}
