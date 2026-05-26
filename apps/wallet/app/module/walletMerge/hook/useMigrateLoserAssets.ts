import { authKey, currentViemClient } from "@frak-labs/wallet-shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Address, Hex } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { MergeError } from "../errors";
import { buildAssetMigrationCalls } from "../utils/buildAssetMigrationCalls";
import { buildMergeBundlerClient } from "../utils/buildMergeBundlerClient";
import { gatePairing, type MergeTransport } from "../utils/transport";
import {
    fetchLoserAssetSummary,
    loserAssetSummaryQueryKey,
} from "./useLoserAssetSummary";

/**
 * Bound on every receipt wait inside this hook. Receipts that take
 * longer than this fall through to the state-recheck recovery path
 * below — the userOp may have landed without us observing the receipt
 * (bundler indexing lag, RPC hiccup), so we re-read the loser summary
 * before failing.
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
 * `{ transport: "local" }` for the same-device merge and for the
 * cross-device case where the LOSER passkey lives on this device.
 * `{ transport: "paired", ensurePairing }` for the cross-device case
 * where the loser passkey lives on the peer (signing routes through
 * the merge's already-open origin pairing).
 */
type UseMigrateLoserAssetsArgs = MergeTransport;

/**
 * Mutation that moves the loser's transferable assets to the winner just
 * before settle.
 *
 * Re-reads the summary on entry — the cached preview value is by then
 * potentially stale (consent/sign biometric prompts gave network time to
 * drift) — then builds and submits a single batched UserOp from the loser
 * smart account. The kernel `executeBatch` runs every call atomically:
 * either every claim + transfer lands, or the whole batch reverts and we
 * surface a retryable error. We wait ≥8 confirmations on the receipt to
 * match the threshold the settle path enforces on the addPassKey hash.
 *
 * Empty summaries short-circuit to a `{ txHash: undefined, entriesMigrated: 0 }`
 * success so the migrate step can auto-advance to settle without rendering
 * a CTA.
 *
 * Idempotency: a successful run drains the loser of stablecoins and
 * claimables, so a subsequent invocation reads an empty summary and
 * no-ops. This is also our recovery path if the user backs out and
 * re-enters the merge flow — the on-chain `addPassKey` is already
 * idempotent, and migrate auto-skips when nothing remains. A revert
 * (stale claimable, RPC race, etc.) surfaces as a retryable error; the
 * user-triggered retry re-reads the summary so the rebuilt UserOp matches
 * fresh chain state.
 */
export function useMigrateLoserAssets(args: UseMigrateLoserAssetsArgs) {
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
                // Re-read the loser summary fresh, bypassing cache. Used
                // both for the idempotent entry short-circuit and for
                // the post-wait recovery path — a successful drain
                // empties the summary, so a stale-cache result would
                // mask the recovered-success case.
                const refreshSummary = () =>
                    queryClient.fetchQuery({
                        queryKey: loserAssetSummaryQueryKey(loser),
                        queryFn: () => fetchLoserAssetSummary(loser),
                        staleTime: 0,
                        gcTime: 0,
                    });

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

                // Wait for the userOp + L2 confirmations. Any failure —
                // timeout, network blip, bundler indexing lag, or a
                // real revert — falls through to the catch where we
                // re-read the loser summary. If the drain landed the
                // summary is empty and we resolve as a recovered
                // success; otherwise we propagate the original error
                // so the migrate step's retry UI shows up.
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
