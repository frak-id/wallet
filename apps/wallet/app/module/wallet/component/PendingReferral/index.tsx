import { isRunningInProd } from "@frak-labs/app-essentials";
import {
    addresses,
    currentStablecoins,
    getViemClientFromChain,
    rewarderHubAbi,
} from "@frak-labs/app-essentials/blockchain";
import { Button } from "@frak-labs/ui/component/Button";
import { balanceKey, claimableKey } from "@frak-labs/wallet-shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { encodeFunctionData, formatUnits } from "viem";
import { multicall } from "viem/actions";
import { arbitrum, arbitrumSepolia } from "viem/chains";
import { useAccount, useSendTransaction } from "wagmi";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import styles from "./index.module.css";

// Stablecoins use 6 decimals
const STABLECOIN_DECIMALS = 6;

export function PendingReferral() {
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    // Get the user wallet address
    const { address } = useAccount();

    const { sendTransactionAsync } = useSendTransaction();

    // Create viem client for the current chain
    const viemClient = useMemo(
        () =>
            getViemClientFromChain({
                chain: isRunningInProd ? arbitrum : arbitrumSepolia,
            }),
        []
    );

    // Fetch the pending reward
    const { data: pendingReward, refetch: refetchPendingReward } = useQuery({
        queryKey: claimableKey.pending.byAddress(address),
        queryFn: async () => {
            if (!address) return [];
            const stablecoinAddresses = Object.values(currentStablecoins);
            const result = await multicall(viemClient, {
                contracts: stablecoinAddresses.map(
                    (token) =>
                        ({
                            address: addresses.rewarderHub,
                            abi: rewarderHubAbi,
                            functionName: "getClaimable",
                            args: [token, address],
                        }) as const
                ),
                allowFailure: false,
            });

            // Return a map of stablecoin address => claimable amount
            const data = stablecoinAddresses
                .map((token, index) => ({
                    token,
                    amount: result[index],
                }))
                .filter((item) => item.amount > 0n);

            return data;
        },
        enabled: !!address,
    });

    // Calculate total claimable in EUR (stablecoins are ~1:1 with fiat)
    const totalClaimable = useMemo(() => {
        if (!pendingReward?.length) return 0;
        const total = pendingReward.reduce(
            (sum, item) => sum + item.amount,
            0n
        );
        return Number(formatUnits(total, STABLECOIN_DECIMALS));
    }, [pendingReward]);

    // Mutation to send the claim txs
    const {
        mutateAsync: sendClaimTxs,
        isPending,
        isSuccess,
    } = useMutation({
        mutationKey: claimableKey.claim.byAddress(address),
        mutationFn: async () => {
            if (!(pendingReward?.length && address)) return;

            // Build each claim tx
            const data = encodeFunctionData({
                abi: rewarderHubAbi,
                functionName: "claimBatch",
                args: [pendingReward.map(({ token }) => token)],
            });

            // Send the user op
            const txHash = await sendTransactionAsync({
                to: addresses.rewarderHub,
                data: data,
            });

            // Refetch the pending reward
            await refetchPendingReward();

            // And refetch the user balance
            await queryClient.invalidateQueries({
                queryKey: balanceKey.baseKey,
                exact: false,
            });

            return txHash;
        },
    });

    if (!pendingReward?.length || totalClaimable <= 0) {
        return null;
    }

    return (
        <Panel size={"small"}>
            <Title icon={<CircleDollarSign width={32} height={32} />}>
                {t("wallet.pendingReferral.title")}
            </Title>
            {isSuccess && (
                <p className={styles.pendingReferral__success}>
                    {t("wallet.pendingReferral.success")}
                </p>
            )}
            {!isSuccess && (
                <>
                    <p>
                        {t("wallet.pendingReferral.text", {
                            eurClaimable: totalClaimable.toFixed(2),
                        })}
                    </p>
                    <Button
                        className={styles.pendingReferral__button}
                        size={"small"}
                        width={"full"}
                        isLoading={isPending}
                        disabled={isPending || isSuccess}
                        onClick={async () => {
                            await sendClaimTxs();
                        }}
                    >
                        {t("common.claim")}
                    </Button>
                </>
            )}
        </Panel>
    );
}
