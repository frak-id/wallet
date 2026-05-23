import {
    addresses,
    currentStablecoins,
    type Stablecoin,
} from "@frak-labs/app-essentials";
import { currentViemClient } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { multicall } from "viem/actions";
import {
    erc20BalanceOfAbi,
    erc20DecimalsAbi,
    rewarderGetClaimableAbi,
} from "@/module/tokens/utils/abi";

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

/** Shared query key — kept stable so the hook's cache feeds the migrate
 *  mutation's `fetchQuery` call without duplicating the key shape. */
export const loserAssetSummaryQueryKey = (loser?: Address) =>
    ["walletMerge", "loserAssetSummary", loser ?? "none"] as const;

/**
 * Read the live on-chain summary in one multicall. Exported (not just used
 * by the hook) so the migration mutation can re-run the exact same read
 * via `queryClient.fetchQuery` right before building its UserOp — keeping
 * the read path single-sourced between the preview surface and the
 * settle-time submission.
 */
export async function fetchLoserAssetSummary(
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

    return {
        loser,
        entries,
        hasFunds: entries.length > 0,
    };
}

/**
 * Live on-chain summary of the loser wallet's transferable assets.
 *
 * Independent of the active session — reads `balanceOf` + rewarder
 * `getClaimable` directly via multicall, so the same hook drives both the
 * preview recap (where the live session is usually NOT the loser) and the
 * pre-settle migration step (where the wagmi session may be on the winner
 * yet we still need to know what's left on the loser).
 *
 * Scope is intentionally bounded to {@link currentStablecoins} — the
 * migration only knows how to move stablecoin balances and claim
 * stablecoin-denominated rewards. Other ERC20s the loser may hold are not
 * surfaced (and would not be transferred).
 *
 * Volatile by design: `meta.storable = false` keeps the query out of the
 * persistent cache; the migration mutation re-runs the same fetcher via
 * `queryClient.fetchQuery` so the built UserOp uses values that match the
 * chain state at submission.
 */
export function useLoserAssetSummary({ loser }: UseLoserAssetSummaryArgs) {
    return useQuery<LoserAssetSummary | null, Error>({
        queryKey: loserAssetSummaryQueryKey(loser),
        enabled: Boolean(loser),
        gcTime: 0,
        meta: { storable: false },
        queryFn: async () => {
            if (!loser) return null;
            return fetchLoserAssetSummary(loser);
        },
    });
}
