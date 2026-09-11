import { authKey, currentViemClient } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import type { Address, Hex } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { MergeError } from "../errors";
import { buildAssetMigrationCalls } from "../utils/buildAssetMigrationCalls";
import { buildMergeBundlerClient } from "../utils/buildMergeBundlerClient";
import { gatePairing, type MergeTransport } from "../utils/transport";
import { loserAssetSummaryQueryOptions } from "./useLoserAssetSummary";

/**
 * Bound on every receipt wait here: a timeout falls through to the
 * state-recheck recovery path, since the userOp may have landed without us
 * observing the receipt.
 */
const RECEIPT_WAIT_TIMEOUT_MS = 20_000;

export type MigrateLoserAssetsArgs = {
    loser: Address;
    winner: Address;
    loserAuthenticatorId: string;
    loserPublicKey: { x: Hex; y: Hex };
};

export type MigrateLoserAssetsResult = {
    /** `undefined` when nothing was due to migrate (no-op success). */
    txHash?: Hex;
    /** Count of summary entries that were transferred. `0` for no-op runs.
     *  Surfaced for analytics (`wallet_merge_succeeded.migrate_token_count`). */
    entriesMigrated: number;
};

/**
 * `{ transport: "local" }` when the LOSER passkey lives on this device,
 * `{ transport: "paired", ensurePairing }` when it lives on the peer.
 */
type UseMigrateLoserAssetsArgs = MergeTransport;

/**
 * Moves the loser's transferable assets to the winner just before settle, as
 * one atomic batched UserOp. Idempotent: a successful run empties the summary,
 * so a re-entry (or a retry after a revert) reads it and no-ops.
 */
export function useMigrateLoserAssets(args: UseMigrateLoserAssetsArgs) {
    return useMutation<MigrateLoserAssetsResult, Error, MigrateLoserAssetsArgs>(
        {
            mutationKey: authKey.merge.migrateLoserAssets,
            gcTime: 0,
            mutationFn: async (
                { loser, winner, loserAuthenticatorId, loserPublicKey },
                { client: queryClient }
            ) => {
                // Bypasses the cache: a stale summary would mask both the
                // entry short-circuit and the recovered-success case.
                const refreshSummary = () =>
                    queryClient.fetchQuery(
                        loserAssetSummaryQueryOptions({ loser })
                    );

                const summary = await refreshSummary();

                if (!summary?.hasFunds) {
                    return { txHash: undefined, entriesMigrated: 0 };
                }

                const calls = buildAssetMigrationCalls({ summary, winner });
                if (calls.length === 0) {
                    return { txHash: undefined, entriesMigrated: 0 };
                }

                await gatePairing(args);

                const client = await buildMergeBundlerClient({
                    address: loser,
                    authenticatorId: loserAuthenticatorId,
                    publicKey: loserPublicKey,
                    transport: args.transport,
                });

                const userOpHash = await client.sendUserOperation({ calls });

                // Any failure falls through to the catch, which re-reads the
                // summary: an empty one means the drain landed anyway and we
                // resolve as a recovered success.
                try {
                    const userOpReceipt =
                        await client.waitForUserOperationReceipt({
                            hash: userOpHash,
                            timeout: RECEIPT_WAIT_TIMEOUT_MS,
                        });
                    if (!userOpReceipt.success) {
                        throw new Error(MergeError.MigrateUserOpReverted);
                    }
                    const receipt = await waitForTransactionReceipt(
                        currentViemClient,
                        {
                            hash: userOpReceipt.receipt.transactionHash,
                            confirmations: 8,
                            timeout: RECEIPT_WAIT_TIMEOUT_MS,
                        }
                    );
                    return {
                        txHash: receipt.transactionHash,
                        entriesMigrated: summary.entries.length,
                    };
                } catch (error) {
                    const fresh = await refreshSummary();
                    if (!fresh?.hasFunds) {
                        return {
                            txHash: undefined,
                            entriesMigrated: summary.entries.length,
                        };
                    }
                    throw error;
                }
            },
        }
    );
}
