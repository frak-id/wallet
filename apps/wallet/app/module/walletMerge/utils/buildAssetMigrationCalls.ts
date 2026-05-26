import { addresses } from "@frak-labs/app-essentials";
import { type Address, encodeFunctionData, type Hex } from "viem";
import { erc20TransferAbi, rewarderClaimAbi } from "@/module/tokens/utils/abi";
import type { LoserAssetSummary } from "../hook/useLoserAssetSummary";

export type AssetMigrationCall = {
    to: Address;
    data: Hex;
    value: bigint;
};

/**
 * Translate a {@link LoserAssetSummary} into the ordered list of calls the
 * loser's kernel `executeBatch` will run atomically:
 *
 *  - One `RewarderHub.claim(token)` per stablecoin with a non-zero
 *    claimable. RewarderHub reverts on an empty claim, so a stale read
 *    here surfaces as a `MERGE_MIGRATE_USER_OP_REVERTED` failure that the
 *    migrate mutation re-runs from scratch (fresh summary, fresh calls)
 *    on user-triggered retry.
 *  - One `ERC20.transfer(winner, balance + claimable)` per stablecoin that
 *    has any value to move. The transfer is sized off the values captured
 *    at read-time; sequencing claim → transfer within the same UserOp
 *    means the just-claimed amount is available in the wallet's balance
 *    before the transfer runs.
 *
 * Returns an empty array when the summary has no funds, so the migrate
 * mutation can short-circuit to a no-op success instead of sending a
 * zero-call UserOp.
 */
export function buildAssetMigrationCalls({
    summary,
    winner,
}: {
    summary: LoserAssetSummary;
    winner: Address;
}): AssetMigrationCall[] {
    const calls: AssetMigrationCall[] = [];
    for (const entry of summary.entries) {
        if (entry.claimable > 0n) {
            calls.push({
                to: addresses.rewarderHub,
                data: encodeFunctionData({
                    abi: [rewarderClaimAbi],
                    functionName: "claim",
                    args: [entry.token],
                }),
                value: 0n,
            });
        }
        const transferAmount = entry.balance + entry.claimable;
        if (transferAmount > 0n) {
            calls.push({
                to: entry.token,
                data: encodeFunctionData({
                    abi: [erc20TransferAbi],
                    functionName: "transfer",
                    args: [winner, transferAmount],
                }),
                value: 0n,
            });
        }
    }
    return calls;
}
