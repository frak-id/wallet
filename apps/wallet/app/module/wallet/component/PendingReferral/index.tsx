import {
    addresses,
    currentStablecoinsList,
    rewarderHubAbi,
} from "@frak-labs/app-essentials/blockchain";
import { Button } from "@frak-labs/ui/component/Button";
import {
    balanceKey,
    claimableKey,
    currentViemClient,
    rewardsKey,
} from "@frak-labs/wallet-shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { encodeFunctionData, erc20Abi, formatUnits } from "viem";
import { multicall, waitForTransactionReceipt } from "viem/actions";
import { useAccount, useSendTransaction } from "wagmi";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import styles from "./index.module.css";

/**
 * sessionStorage key tracking the block where the last claim tx was confirmed.
 * Used to pin the multicall read to that block, bypassing ERPC cache that may
 * still serve pre-claim state for "latest".
 * sessionStorage is ideal — survives reload, clears on tab close.
 */
const LAST_CLAIM_BLOCK_KEY = "frak_last_claim_block";

export function PendingReferral() {
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const { address } = useAccount();
    const { sendTransactionAsync } = useSendTransaction();

    // Fetch claimable amounts + decimals for all known stablecoins via on-chain multicall
    const { data: pendingReward, refetch: refetchPendingReward } = useQuery({
        queryKey: claimableKey.pending.byAddress(address),
        queryFn: async () => {
            if (!address) return [];

            // Batch claimable + decimals calls in a single multicall
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

            // Pin to the last claim block to bypass ERPC cache, then clear
            const lastClaimBlock = sessionStorage.getItem(
                LAST_CLAIM_BLOCK_KEY
            );
            const result = await multicall(currentViemClient, {
                contracts,
                allowFailure: false,
                ...(lastClaimBlock
                    ? { blockNumber: BigInt(lastClaimBlock) }
                    : {}),
            });
            if (lastClaimBlock) {
                sessionStorage.removeItem(LAST_CLAIM_BLOCK_KEY);
            }

            // Results alternate: [claimable0, decimals0, claimable1, decimals1, ...]
            return currentStablecoinsList
                .map((token, index) => ({
                    token,
                    amount: result[index * 2] as bigint,
                    decimals: result[index * 2 + 1] as number,
                }))
                .filter((item) => item.amount > 0n);
        },
        enabled: !!address,
        // Volatile on-chain state — must always fetch fresh, never persist to localStorage
        meta: { storable: false },
    });

    // Calculate total claimable in fiat (stablecoins ~1:1)
    const totalClaimable = useMemo(() => {
        if (!pendingReward?.length) return 0;
        return pendingReward.reduce(
            (sum, item) =>
                sum + Number(formatUnits(item.amount, item.decimals)),
            0
        );
    }, [pendingReward]);

    // Mutation to send the batch claim tx
    const {
        mutateAsync: sendClaimTxs,
        isPending,
        isSuccess,
    } = useMutation({
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

            // Optimistically clear claimable data before refetch —
            // prevents stale data persisting if RPC cache lags behind on-chain state
            queryClient.setQueryData(
                claimableKey.pending.byAddress(address),
                []
            );
            // Wait for on-chain confirmation, then persist the block number
            // so reloads can pin reads past the ERPC cache
            const receipt = await waitForTransactionReceipt(
                currentViemClient,
                { hash: txHash }
            );
            sessionStorage.setItem(
                LAST_CLAIM_BLOCK_KEY,
                receipt.blockNumber.toString()
            );
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
