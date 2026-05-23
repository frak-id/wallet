import { authKey, currentViemClient } from "@frak-labs/wallet-shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Address, Hex } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { buildAssetMigrationCalls } from "../utils/buildAssetMigrationCalls";
import { buildLoserBundlerClient } from "../utils/buildLoserBundlerClient";
import {
    fetchLoserAssetSummary,
    loserAssetSummaryQueryKey,
} from "./useLoserAssetSummary";

export type MigrateLoserAssetsArgs = {
    loser: Address;
    winner: Address;
    loserAuthenticatorId: string;
    loserPublicKey: { x: Hex; y: Hex };
};

export type MigrateLoserAssetsResult = {
    /** `undefined` when nothing was due to migrate (no-op success). */
    txHash?: Hex;
};

type UseMigrateLoserAssetsArgs = {
    /**
     * `"local"` for the same-device merge and for the cross-device case
     * where the LOSER passkey lives on this device. `"paired"` for the
     * cross-device case where the loser passkey lives on the peer (signing
     * routes through the merge's already-open origin pairing).
     */
    transport: "local" | "paired";
};

/**
 * Mutation that moves the loser's transferable assets to the winner just
 * before settle.
 *
 * Re-reads the summary on entry — the cached preview value is by then
 * potentially stale (consent/sign biometric prompts gave network time to
 * drift) — then builds and submits a single batched UserOp from the loser
 * smart account. The kernel `executeBatch` runs every call atomically:
 * either every claim + transfer lands, or the whole batch reverts and we
 * surface a retryable error.
 *
 * Empty summaries short-circuit to a `{ txHash: undefined }` success so
 * the migrate step can auto-advance to settle without rendering a CTA.
 *
 * Idempotency: a successful run drains the loser of stablecoins and
 * claimables, so a subsequent invocation reads an empty summary and
 * no-ops. This is also our recovery path if the user backs out and
 * re-enters the merge flow — the on-chain `addPassKey` is already idempotent,
 * and migrate auto-skips when nothing remains.
 */
export function useMigrateLoserAssets({
    transport,
}: UseMigrateLoserAssetsArgs) {
    const queryClient = useQueryClient();
    return useMutation<MigrateLoserAssetsResult, Error, MigrateLoserAssetsArgs>(
        {
            mutationKey: authKey.merge.migrateLoserAssets,
            gcTime: 0,
            mutationFn: async ({
                loser,
                winner,
                loserAuthenticatorId,
                loserPublicKey,
            }) => {
                const summary = await queryClient.fetchQuery({
                    queryKey: loserAssetSummaryQueryKey(loser),
                    queryFn: () => fetchLoserAssetSummary(loser),
                    staleTime: 0,
                    gcTime: 0,
                });

                if (!summary?.hasFunds) {
                    return { txHash: undefined };
                }

                const calls = buildAssetMigrationCalls({ summary, winner });
                if (calls.length === 0) return { txHash: undefined };

                const client = await buildLoserBundlerClient({
                    loser,
                    loserAuthenticatorId,
                    loserPublicKey,
                    transport,
                });

                const txHash = await client.sendUserOperation({ calls });

                const receipt = await waitForTransactionReceipt(
                    currentViemClient,
                    {
                        hash: txHash,
                    }
                );
                if (receipt.status !== "success") {
                    throw new Error("MERGE_MIGRATE_USER_OP_REVERTED");
                }

                return { txHash };
            },
        }
    );
}
