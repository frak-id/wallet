import { viemClient } from "@backend-infrastructure";
import {
    addresses,
    multiWebAuthNValidatorV2Abi,
} from "@frak-labs/app-essentials";
import { type Address, type Hex, keccak256, toHex } from "viem";
import { readContract, waitForTransactionReceipt } from "viem/actions";

/**
 * Thin wrapper around the on-chain reads we need to verify a wallet merge:
 * fetching the passkey registered for a smart wallet, and confirming a
 * user-operation hash has actually landed.
 *
 * Single-chain by design — the backend deployment is pinned to one chain
 * (`currentChainId`), so `viemClient` is the only relevant client. If we
 * ever need multi-chain inside a single deployment, this class is the
 * place to add a chain-id-keyed client map.
 */
export class WebAuthNValidatorReader {
    /**
     * Read the passkey currently registered at `_smartWallet` for the given
     * `authenticatorId` on the validator contract. Returns the on-chain
     * `(x, y)` public key.
     *
     * The validator hashes the authenticator id (UTF-8 bytes) with keccak256
     * before storing it, so the lookup key is `keccak256(toHex(id))`.
     */
    async getPasskey(params: {
        smartWallet: Address;
        authenticatorId: string;
    }): Promise<{ x: bigint; y: bigint } | null> {
        const authenticatorIdHash = keccak256(toHex(params.authenticatorId));
        const [storedId, pubKey] = await readContract(viemClient, {
            address: addresses.webAuthNValidator,
            abi: multiWebAuthNValidatorV2Abi,
            functionName: "getPasskey",
            args: [params.smartWallet, authenticatorIdHash],
        });
        // Validator returns the zero-hash + (0, 0) when the credential is
        // not registered on the wallet. Surface that as `null` so the
        // orchestrator can distinguish "not present" from "wrong key".
        if (
            storedId ===
                "0x0000000000000000000000000000000000000000000000000000000000000000" ||
            (pubKey.x === 0n && pubKey.y === 0n)
        ) {
            return null;
        }
        return { x: pubKey.x, y: pubKey.y };
    }

    /**
     * Block until the merge transaction lands (or fails). Returns the
     * receipt-level status so the orchestrator can short-circuit when the
     * userOp reverted on-chain.
     */
    async waitForReceipt(params: {
        txHash: Hex;
    }): Promise<{ status: "success" | "reverted"; blockNumber: bigint }> {
        const receipt = await waitForTransactionReceipt(viemClient, {
            hash: params.txHash,
            confirmations: 8,
        });
        return {
            status: receipt.status === "success" ? "success" : "reverted",
            blockNumber: receipt.blockNumber,
        };
    }
}

export const webAuthNValidatorReader = new WebAuthNValidatorReader();
