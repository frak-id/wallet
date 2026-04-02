import {
    addresses,
    currentStablecoinsList,
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { encodeFunctionData, erc20Abi, formatUnits } from "viem";
import { multicall, waitForTransactionReceipt } from "viem/actions";
import { useAccount, useSendTransaction } from "wagmi";
import { CloseButton } from "@/module/common/component/CloseButton";
import { modalStore } from "@/module/stores/modalStore";
import * as styles from "./index.css";

type PendingGainsModalProps = {
    onClose: () => void;
};

export function PendingGainsModal({ onClose }: PendingGainsModalProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { address } = useAccount();
    const { sendTransactionAsync } = useSendTransaction();

    // Fetch claimable amounts via on-chain multicall
    const { data: pendingReward, refetch: refetchPendingReward } = useQuery({
        queryKey: claimableKey.pending.byAddress(address),
        queryFn: async () => {
            if (!address) return [];

            const contracts = currentStablecoinsList.flatMap(
                (token) =>
                    [
                        {
                            address: addresses.rewarderHub,
                            abi: rewarderHubAbi,
                            functionName: "getClaimable",
                            args: [address, token],
                        },
                        {
                            address: token,
                            abi: erc20Abi,
                            functionName: "decimals",
                        },
                    ] as const
            );

            const result = await multicall(currentViemClient, {
                contracts,
                allowFailure: false,
            });

            return currentStablecoinsList
                .map((token, index) => ({
                    token,
                    amount: result[index * 2] as bigint,
                    decimals: result[index * 2 + 1] as number,
                }))
                .filter((item) => item.amount > 0n);
        },
        enabled: !!address,
        meta: { storable: false },
    });

    const totalClaimable = useMemo(() => {
        if (!pendingReward?.length) return 0;
        return pendingReward.reduce(
            (sum, item) =>
                sum + Number(formatUnits(item.amount, item.decimals)),
            0
        );
    }, [pendingReward]);

    // Claim mutation
    const { mutateAsync: sendClaimTxs, isPending } = useMutation({
        mutationKey: claimableKey.claim.byAddress(address),
        mutationFn: async () => {
            if (!(pendingReward?.length && address)) return;

            const data = encodeFunctionData({
                abi: rewarderHubAbi,
                functionName: "claimBatch",
                args: [pendingReward.map(({ token }) => token)],
            });

            const txHash = await sendTransactionAsync({
                to: addresses.rewarderHub,
                data,
            });

            queryClient.setQueryData(
                claimableKey.pending.byAddress(address),
                []
            );
            await waitForTransactionReceipt(currentViemClient, {
                hash: txHash,
            });
            await refetchPendingReward();
            await queryClient.invalidateQueries({
                queryKey: balanceKey.baseKey,
                exact: false,
            });
            await queryClient.invalidateQueries({
                queryKey: rewardsKey.all,
                exact: false,
            });
            return txHash;
        },
        onSuccess: () => {
            modalStore.getState().openModal({ id: "successOverlay" });
        },
    });

    const title = t("wallet.pendingGains.subtitle");
    const description = t("wallet.pendingGains.description");
    const closeLabel = t("common.close");

    const formattedAmount = `+${totalClaimable.toFixed(2).replace(".", ",")}€`;

    return (
        <ResponsiveModal
            open={true}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={title}
            description={description}
            header={
                <CloseButton
                    ariaLabel={closeLabel}
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
