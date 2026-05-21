import {
    addresses,
    multiWebAuthNValidatorV2Abi,
} from "@frak-labs/app-essentials";
import { authKey, currentViemClient } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { encodeFunctionData, type Hex, keccak256, toHex } from "viem";
import { readContract } from "viem/actions";
import { useConnection, useSendTransaction } from "wagmi";

type UseSendAddPassKeyTxArgs = {
    /** Credential id of the loser passkey being added to the winner wallet. */
    loserAuthenticatorId: string;
    /** Loser passkey pubkey, as taken from the merge preview. */
    loserPublicKey: { x: Hex; y: Hex };
};

/**
 * Sends the on-chain `addPassKey(authenticatorIdHash, x, y)` userOp through
 * the live wagmi smart-account session. The caller is expected to have
 * already switched the live session to the winner credential
 * (`useSwitchAuthenticator`) so the userOp is produced from the winner's
 * smart-account context.
 *
 * Returns the transaction hash. The settle step (`useMergeSettle`) takes that
 * hash and finalises the off-chain repoint + identity merge.
 */
export function useSendAddPassKeyTx() {
    const { mutateAsync: sendTransactionAsync } = useSendTransaction();
    const { address } = useConnection();

    return useMutation<Hex, Error, UseSendAddPassKeyTxArgs>({
        mutationKey: authKey.merge.sendAddPassKey,
        gcTime: 0,
        mutationFn: async ({ loserAuthenticatorId, loserPublicKey }) => {
            const loserAuthenticatorIdHash = keccak256(
                toHex(loserAuthenticatorId)
            );
            // Check if loser cred is already present
            if (address) {
                const [_, pubKey] = await readContract(currentViemClient, {
                    address: addresses.webAuthNValidator,
                    abi: multiWebAuthNValidatorV2Abi,
                    functionName: "getPasskey",
                    args: [address, loserAuthenticatorIdHash],
                });

                // If yes early exit
                if (
                    pubKey.x === BigInt(loserPublicKey.x) &&
                    pubKey.y === BigInt(loserPublicKey.y)
                ) {
                    return "0x";
                }
            }

            const data = encodeFunctionData({
                abi: multiWebAuthNValidatorV2Abi,
                functionName: "addPassKey",
                args: [
                    loserAuthenticatorIdHash,
                    BigInt(loserPublicKey.x),
                    BigInt(loserPublicKey.y),
                ],
            });
            return sendTransactionAsync({
                to: addresses.webAuthNValidator,
                data,
            });
        },
    });
}
