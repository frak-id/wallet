import {
    addresses,
    multiWebAuthNValidatorV2Abi,
} from "@frak-labs/app-essentials";
import { authKey, currentViemClient } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import {
    type Address,
    encodeFunctionData,
    type Hex,
    keccak256,
    toHex,
} from "viem";
import { readContract } from "viem/actions";
import { buildMergeBundlerClient } from "../utils/buildMergeBundlerClient";

export type SendAddPassKeyResult = {
    /**
     * `undefined` when the loser passkey is already bound to the winner
     * wallet on-chain (idempotent no-op success — happens on retries after
     * a previous landed userOp).
     */
    txHash?: Hex;
};

export type SendAddPassKeyArgs = {
    /** Winner smart wallet — owner of the addPassKey userOp. */
    winner: Address;
    /** Credential id of the winner passkey (signs the userOp). */
    winnerAuthenticatorId: string;
    /** Winner passkey pubkey, as taken from the merge preview. */
    winnerPublicKey: { x: Hex; y: Hex };
    /** Credential id of the loser passkey being added to the winner wallet. */
    loserAuthenticatorId: string;
    /** Loser passkey pubkey, as taken from the merge preview. */
    loserPublicKey: { x: Hex; y: Hex };
};

type UseSendAddPassKeyTxArgs = {
    /**
     * `"local"` for the same-device merge and for the cross-device case
     * where the WINNER passkey lives on this device. `"paired"` for the
     * cross-device case where the winner passkey lives on the peer
     * (signing routes through the merge's already-open origin pairing).
     */
    transport: "local" | "paired";
    /**
     * Awaited before signing when `transport === "paired"`. Supplied by
     * the remote strategy; it status-guards `initiatePairing` so an
     * already-live pairing is reused instead of torn down. Omitted by
     * the local strategy.
     */
    ensurePairing?: () => Promise<void>;
};

/**
 * Sends the on-chain `addPassKey(authenticatorIdHash, x, y)` userOp from
 * the winner smart wallet, binding the loser passkey to it.
 *
 * Builds a dedicated bundler client pinned to the winner identity instead
 * of going through wagmi — this lets the merge run without ever swapping
 * the live wagmi session, so the flow is symmetric with the loser-side
 * asset migration step. Transport selection mirrors `useMigrateLoserAssets`.
 *
 * Idempotent: a read of the on-chain validator first short-circuits with
 * `{ txHash: undefined }` if the loser passkey is already bound, so a
 * retry after a previously-landed addPassKey skips straight to settle.
 *
 * Returns the userOp hash. The settle step (`useMergeSettle`) takes that
 * hash and waits for ≥8 confirmations before finalising the off-chain
 * repoint + identity merge.
 */
export function useSendAddPassKeyTx({
    transport,
    ensurePairing,
}: UseSendAddPassKeyTxArgs) {
    return useMutation<SendAddPassKeyResult, Error, SendAddPassKeyArgs>({
        mutationKey: authKey.merge.sendAddPassKey,
        gcTime: 0,
        mutationFn: async ({
            winner,
            winnerAuthenticatorId,
            winnerPublicKey,
            loserAuthenticatorId,
            loserPublicKey,
        }) => {
            const loserAuthenticatorIdHash = keccak256(
                toHex(loserAuthenticatorId)
            );

            // Idempotent early exit if loser cred already lives under winner
            // on-chain (a previously-landed addPassKey from an earlier
            // run-through). The settle step will treat `txHash: undefined`
            // as "nothing to wait for" and skip straight to the POST.
            const [_, existing] = await readContract(currentViemClient, {
                address: addresses.webAuthNValidator,
                abi: multiWebAuthNValidatorV2Abi,
                functionName: "getPasskey",
                args: [winner, loserAuthenticatorIdHash],
            });
            if (
                existing.x === BigInt(loserPublicKey.x) &&
                existing.y === BigInt(loserPublicKey.y)
            ) {
                return { txHash: undefined };
            }

            if (transport === "paired") {
                if (!ensurePairing) {
                    throw new Error(
                        "MERGE_SEND_ADD_PASSKEY_MISSING_PAIRING_SETUP"
                    );
                }
                await ensurePairing();
            }

            const client = await buildMergeBundlerClient({
                address: winner,
                authenticatorId: winnerAuthenticatorId,
                publicKey: winnerPublicKey,
                transport,
            });

            const data = encodeFunctionData({
                abi: multiWebAuthNValidatorV2Abi,
                functionName: "addPassKey",
                args: [
                    loserAuthenticatorIdHash,
                    BigInt(loserPublicKey.x),
                    BigInt(loserPublicKey.y),
                ],
            });

            const userOpHash = await client.sendUserOperation({
                calls: [
                    {
                        to: addresses.webAuthNValidator,
                        data,
                    },
                ],
            });

            // Wait rapidly for the user op receipt
            const userOpReceipt = await client.waitForUserOperationReceipt({
                hash: userOpHash,
            });

            return { txHash: userOpReceipt.receipt.transactionHash };
        },
    });
}
