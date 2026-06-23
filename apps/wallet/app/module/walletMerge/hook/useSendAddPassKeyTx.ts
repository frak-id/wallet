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
import { readContract, waitForTransactionReceipt } from "viem/actions";
import { MergeError } from "../errors";
import { buildMergeBundlerClient } from "../utils/buildMergeBundlerClient";
import { gatePairing, type MergeTransport } from "../utils/transport";

/**
 * Bound on every receipt wait inside this hook. Receipts that take longer
 * than this are caught and routed to the state-recheck recovery path
 * below — the userOp may have landed without us observing the receipt
 * (RPC hiccup, bundler lag), so we re-read the validator before failing.
 */
const RECEIPT_WAIT_TIMEOUT_MS = 20_000;

export type SendAddPassKeyResult = {
    /**
     * `undefined` when the loser passkey was already bound to the winner
     * wallet on-chain at mutate-time (idempotent no-op) OR when the
     * receipt wait failed but a follow-up read confirmed the binding
     * landed anyway (recovered no-op).
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

/**
 * `{ transport: "local" }` for the same-device merge and for the
 * cross-device case where the WINNER passkey lives on this device.
 * `{ transport: "paired", ensurePairing }` for the cross-device case
 * where the winner passkey lives on the peer (signing routes through
 * the merge's already-open origin pairing).
 */
type UseSendAddPassKeyTxArgs = MergeTransport;

/**
 * Sends the on-chain `addPassKey(authenticatorIdHash, x, y)` userOp from
 * the winner smart wallet, binding the loser passkey to it.
 *
 * Builds a dedicated bundler client pinned to the winner identity instead
 * of going through wagmi — this lets the merge run without ever swapping
 * the live wagmi session, so the flow is symmetric with the loser-side
 * asset migration step. Transport selection mirrors `useMigrateLoserAssets`.
 *
 * Owns the full "send + wait for chain finality" pipeline so the settle
 * step doesn't have to: waits for the userOp receipt, then for ≥8 L2
 * confirmations, both bounded by {@link RECEIPT_WAIT_TIMEOUT_MS}. On any
 * wait failure (timeout / RPC / network) we re-read the validator: if
 * the binding is already there the userOp landed out of band and we
 * resolve as success; if it isn't, the original error propagates so the
 * SignStep retry path kicks in.
 *
 * Idempotent: the validator read runs both at entry (short-circuit when
 * a previous run already bound the passkey) and on the recovery path,
 * so retries converge regardless of where the previous attempt died.
 *
 * Returns the included L2 tx hash, or `undefined` for the two no-op
 * success paths (already-bound at entry, or recovered after a wait
 * failure). The settle step doesn't read this value any more — it's
 * kept for analytics / future use.
 */
export function useSendAddPassKeyTx(args: UseSendAddPassKeyTxArgs) {
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

            // Read the validator for the (winner, loserCredHash) slot
            // and return true iff the on-chain pubkey matches the loser
            // pubkey we're trying to bind. Used both for the idempotent
            // entry short-circuit and the post-wait recovery path.
            const isLoserBound = async () => {
                const [_, existing] = await readContract(currentViemClient, {
                    address: addresses.webAuthNValidator,
                    abi: multiWebAuthNValidatorV2Abi,
                    functionName: "getPasskey",
                    args: [winner, loserAuthenticatorIdHash],
                });
                return (
                    existing.x === BigInt(loserPublicKey.x) &&
                    existing.y === BigInt(loserPublicKey.y)
                );
            };

            // Idempotent early exit if loser cred already lives under winner
            // on-chain (a previously-landed addPassKey from an earlier
            // run-through).
            if (await isLoserBound()) {
                return { txHash: undefined };
            }

            await gatePairing(args);

            const client = await buildMergeBundlerClient({
                address: winner,
                authenticatorId: winnerAuthenticatorId,
                publicKey: winnerPublicKey,
                transport: args.transport,
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

            // Wait for the userOp + L2 confirmations. Any failure —
            // timeout, network blip, bundler indexing lag, or a real
            // revert — falls through to the catch where we re-read the
            // validator. If the binding is already there we treat the
            // mutation as a recovered success; otherwise we propagate
            // the original error so the SignStep retry UI shows up.
            try {
                const userOpReceipt = await client.waitForUserOperationReceipt({
                    hash: userOpHash,
                    timeout: RECEIPT_WAIT_TIMEOUT_MS,
                });
                if (!userOpReceipt.success) {
                    throw new Error(MergeError.AddPassKeyUserOpReverted);
                }
                const receipt = await waitForTransactionReceipt(
                    currentViemClient,
                    {
                        hash: userOpReceipt.receipt.transactionHash,
                        confirmations: 8,
                        timeout: RECEIPT_WAIT_TIMEOUT_MS,
                    }
                );
                return { txHash: receipt.transactionHash };
            } catch (error) {
                if (await isLoserBound()) {
                    return { txHash: undefined };
                }
                throw error;
            }
        },
    });
}
