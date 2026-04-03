import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import type { RecoveryFileContent } from "@frak-labs/wallet-shared";
import { SendHorizontal } from "lucide-react";
import { sleep } from "radash";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Hex } from "viem";
import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { usePerformRecovery } from "@/module/recovery/hook/usePerformRecovery";
import { useRecoveryAvailability } from "@/module/recovery/hook/useRecoveryAvailability";
import {
    recoveryStore,
    selectRecoveryFileContent,
    selectRecoveryGuardianAccount,
    selectRecoveryNewWallet,
} from "@/module/stores/recoveryStore";
import { ExplorerTxLink } from "@/module/wallet/component/ExplorerLink";
import * as styles from "./Step5.css";

const ACTUAL_STEP = 5;

export function Step5() {
    const { t } = useTranslation();
    // Get the recovery file product
    const recoveryFileContent = recoveryStore(selectRecoveryFileContent);

    return (
        <AccordionRecoveryItem
            actualStep={ACTUAL_STEP}
            title={t("wallet.recovery.step5")}
        >
            {recoveryFileContent && (
                <TriggerRecovery recoveryFileContent={recoveryFileContent} />
            )}
        </AccordionRecoveryItem>
    );
}

function TriggerRecovery({
    recoveryFileContent,
}: {
    recoveryFileContent: RecoveryFileContent;
}) {
    const { t } = useTranslation();
    // Get the guardian account
    const guardianAccount = recoveryStore(selectRecoveryGuardianAccount);

    // Get the new authenticator id
    const newWallet = recoveryStore(selectRecoveryNewWallet);

    // Get the available chains for recovery
    const { recoveryAvailability, isLoading } = useRecoveryAvailability({
        file: recoveryFileContent,
        newAuthenticatorId: newWallet?.authenticatorId ?? "",
    });

    /**
     * Hook to perform the recovery
     */
    const {
        performRecovery,
        isPending,
        isSuccess,
        status,
        data: txHash,
    } = usePerformRecovery({
        onSuccess: async () => {
            // On success, wait 2sec on go to the next step
            await sleep(2000);
            recoveryStore.getState().setStep(ACTUAL_STEP + 1);
        },
    });

    /**
     * Check if the recovery is available
     */
    const isRecoveryAvailable = useMemo(() => {
        if (recoveryAvailability?.available === false) {
            return false;
        }

        return recoveryAvailability?.alreadyRecovered !== true;
    }, [recoveryAvailability]);

    const currentStatus = useRecoveryStatus({
        recoveryAvailability: recoveryAvailability,
        status: status,
        txHash: txHash,
    });

    if (!(guardianAccount && newWallet)) {
        return null;
    }

    if (isLoading || !recoveryAvailability) {
        return (
            <Text>
                {t("wallet.recovery.loadingRecovery")}
                <span className={"dotsLoading"}>...</span>
            </Text>
        );
    }

    return (
        <>
            {currentStatus}

            {isRecoveryAvailable && (
                <Box className={styles.pushPasskey}>
                    <Button
                        className={styles.buttonPush}
                        disabled={
                            !isRecoveryAvailable || isPending || isSuccess
                        }
                        onClick={() =>
                            performRecovery({
                                file: recoveryFileContent,
                                newWallet,
                                recoveryAccount: guardianAccount,
                            })
                        }
                        icon={<SendHorizontal size={16} />}
                    >
                        {t("wallet.recovery.pushPasskey")}
                    </Button>
                </Box>
            )}
        </>
    );
}

function useRecoveryStatus({
    recoveryAvailability,
    status,
    txHash,
}: {
    recoveryAvailability:
        | { available: boolean; alreadyRecovered?: boolean }
        | undefined;
    status: "idle" | "pending" | "error" | "success";
    txHash?: Hex;
}) {
    const { t } = useTranslation();
    return useMemo(() => {
        if (!recoveryAvailability) {
            return <Text>{t("wallet.recovery.status.loading")}</Text>;
        }

        if (recoveryAvailability?.alreadyRecovered) {
            return (
                <Text as="span" className={styles.statusSuccess}>
                    {t("wallet.recovery.status.walletAlready")}
                </Text>
            );
        }
        if (status === "pending") {
            return (
                <Text as="span" className={styles.statusPending}>
                    {t("wallet.recovery.status.inProgress")}
                    <span className={"dotsLoading"}>...</span>
                </Text>
            );
        }
        if (status === "success") {
            return (
                <Text as="span" className={styles.statusSuccess}>
                    {t("wallet.recovery.status.done")}{" "}
                    <ExplorerTxLink
                        hash={txHash ?? "0x"}
                        icon={false}
                        className={styles.statusLink}
                    />
                </Text>
            );
        }
        if (status === "error") {
            return (
                <Text as="span" className={styles.statusError}>
                    {t("wallet.recovery.status.error")}
                </Text>
            );
        }
        return (
            <Text as="span" className={styles.statusPending}>
                {t("wallet.recovery.status.pending")}
            </Text>
        );
    }, [status, txHash, recoveryAvailability, t]);
}
