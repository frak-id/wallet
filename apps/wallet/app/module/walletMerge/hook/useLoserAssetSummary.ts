import {
    addresses,
    currentStablecoins,
    type Stablecoin,
} from "@frak-labs/app-essentials";
import { currentViemClient } from "@frak-labs/wallet-shared";
import { queryOptions } from "@tanstack/react-query";
import type { Address } from "viem";
import { multicall } from "viem/actions";
import {
    erc20BalanceOfAbi,
    erc20DecimalsAbi,
    rewarderGetClaimableAbi,
} from "@/module/tokens/utils/abi";
import { walletMergeKey } from "../queryKeys/walletMerge";

const STABLECOIN_IDS = Object.keys(currentStablecoins) as Stablecoin[];

const STABLECOIN_SYMBOL: Record<Stablecoin, string> = {
    usdc: "USDC",
    usde: "USDe",
    eure: "EURe",
    gbpe: "GBPe",
};

export type LoserAssetSummaryEntry = {
    id: Stablecoin;
    token: Address;
    symbol: string;
    decimals: number;
    balance: bigint;
    claimable: bigint;
};

export type LoserAssetSummary = {
    loser: Address;
    entries: LoserAssetSummaryEntry[];
    hasFunds: boolean;
};

type UseLoserAssetSummaryArgs = {
    loser?: Address;
};

/**
 * Read the live on-chain summary in one multicall. Exported (not just used
 * by the hook) so the migration mutation can re-run the exact same read
 * via `queryClient.fetchQuery` right before building its UserOp — keeping
 * the read path single-sourced between the preview surface and the
 * settle-time submission.
 */
async function fetchLoserAssetSummary(
    loser: Address
): Promise<LoserAssetSummary> {
    const contracts = STABLECOIN_IDS.flatMap((id) => {
        const token = currentStablecoins[id];
        return [
            {
                address: token,
                abi: [erc20BalanceOfAbi],
                functionName: "balanceOf",
                args: [loser],
            },
            {
                address: addresses.rewarderHub,
                abi: [rewarderGetClaimableAbi],
                functionName: "getClaimable",
                args: [loser, token],
            },
            {
                address: token,
                abi: [erc20DecimalsAbi],
                functionName: "decimals",
            },
        ] as const;
    });

    const result = await multicall(currentViemClient, {
        contracts,
        allowFailure: false,
    });

    const entries: LoserAssetSummaryEntry[] = STABLECOIN_IDS.flatMap(
        (id, index) => {
            const offset = index * 3;
            const balance = result[offset] as bigint;
            const claimable = result[offset + 1] as bigint;
            const decimals = result[offset + 2] as number;
            if (balance === 0n && claimable === 0n) return [];
            return [
                {
                    id,
                    token: currentStablecoins[id],
                    symbol: STABLECOIN_SYMBOL[id],
                    decimals,
                    balance,
                    claimable,
                },
            ];
        }
    );

    // Largest holdings first so dust never pushes a meaningful balance
    // off the visible area. Comparator returns the bigint sign instead of
    // a Number cast — keeps full precision when balances differ by sub-cent
    // amounts at high decimals.
    entries.sort((a, b) => {
        const aTotal = a.balance + a.claimable;
        const bTotal = b.balance + b.claimable;
        if (bTotal === aTotal) return 0;
        return bTotal > aTotal ? 1 : -1;
    });

    return {
        loser,
        entries,
        hasFunds: entries.length > 0,
    };
}

export function looserAssetSummaryQueryOpt({
    loser,
}: UseLoserAssetSummaryArgs) {
    return queryOptions({
        queryKey: walletMergeKey.loserAssetSummary(loser),
        enabled: Boolean(loser),
        gcTime: 0,
        meta: { storable: false },
        queryFn: async () => {
            if (!loser) return null;
            return fetchLoserAssetSummary(loser);
        },
    });
}
