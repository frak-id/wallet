import {
    addresses,
    multiWebAuthNValidatorV2Abi,
} from "@frak-labs/app-essentials";
import { authKey } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { encodeFunctionData, type Hex, keccak256, toHex } from "viem";
import { useSendTransaction } from "wagmi";

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
    const { sendTransactionAsync } = useSendTransaction();

    return useMutation<Hex, Error, UseSendAddPassKeyTxArgs>({
        mutationKey: authKey.merge.sendAddPassKey,
        gcTime: 0,
        mutationFn: async ({ loserAuthenticatorId, loserPublicKey }) => {
            const data = encodeFunctionData({
                abi: multiWebAuthNValidatorV2Abi,
                functionName: "addPassKey",
                args: [
                    keccak256(toHex(loserAuthenticatorId)),
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
