import {
    addresses,
    rewarderHubAbi,
} from "@frak-labs/app-essentials/blockchain";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    balanceKey,
    claimableKey,
    currentViemClient,
    rewardsKey,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { encodeFunctionData } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { useConnection, useSendTransaction } from "wagmi";
import { CloseButton } from "@/module/common/component/CloseButton";
import { useGetPendingRewards } from "../../hooks/useGetPendingRewards";
import * as styles from "./index.css";

type PendingGainsModalProps = {
    onClose: () => void;
};

export function PendingGainsModal({ onClose }: PendingGainsModalProps) {
    const { t } = useTranslation();
    const { address } = useConnection();
    const { mutateAsync: sendTransactionAsync } = useSendTransaction();
    const { totalClaimable, pendingRewards } = useGetPendingRewards();

    // Claim mutation
    const { mutateAsync: sendClaimTxs, isPending } = useMutation({
        mutationKey: claimableKey.claim.byAddress(address),
        mutationFn: async (_data, { client }) => {
            if (!(pendingRewards?.length && address)) return;

            const data = encodeFunctionData({
                abi: rewarderHubAbi,
                functionName: "claimBatch",
                args: [pendingRewards.map(({ token }) => token)],
            });

            const txHash = await sendTransactionAsync({
                to: addresses.rewarderHub,
                data,
            });

            client.setQueryData(claimableKey.pending.byAddress(address), []);
            await waitForTransactionReceipt(currentViemClient, {
                hash: txHash,
            });

            await Promise.all([
                client.invalidateQueries({
                    queryKey: claimableKey.baseKey,
                    exact: false,
                }),
                client.invalidateQueries({
                    queryKey: balanceKey.baseKey,
                    exact: false,
                }),
                client.invalidateQueries({
                    queryKey: rewardsKey.all,
                    exact: false,
                }),
            ]);
            return txHash;
        },
        onSuccess: () => {
            onClose();
        },
    });

    const formattedAmount = `+${totalClaimable.toFixed(2).replace(".", ",")}€`;

    return (
        <ResponsiveModal
            open={true}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={t("wallet.pendingGains.subtitle")}
            description={t("wallet.pendingGains.description")}
            header={
                <CloseButton
                    ariaLabel={t("common.close")}
                    iconSize={24}
                    variant="inline"
                    onClick={onClose}
                />
            }
        >
            <Box className={styles.pendingGains}>
                <Box className={styles.textGroup}>
                    <Box className={styles.amountBlock}>
                        <Text as="p" variant="caption" color="secondary">
                            {t("wallet.pendingGains.subtitle")}
                        </Text>
                        <Text as="p" className={styles.amount}>
                            {formattedAmount}
                        </Text>
                    </Box>
                    <Text as="h2" className={styles.heading}>
                        {t("wallet.pendingGains.heading")}
                    </Text>
                    <Text as="p" color="secondary">
                        {t("wallet.pendingGains.description")}
                    </Text>
                </Box>
                <Button
                    className={styles.confirmButton}
                    disabled={isPending || totalClaimable <= 0}
                    onClick={async () => {
                        await sendClaimTxs();
                    }}
                >
                    {t("wallet.pendingGains.confirm")}
                </Button>
            </Box>
        </ResponsiveModal>
    );
}
