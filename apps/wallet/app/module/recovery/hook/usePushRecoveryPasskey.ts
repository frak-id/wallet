import {
    currentViemClient,
    getPimlicoClient,
    getPimlicoTransport,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { smartAccountActions } from "permissionless";
import { getUserOperationGasPrice } from "permissionless/actions/pimlico";
import {
    type Address,
    encodeFunctionData,
    type Hex,
    keccak256,
    type LocalAccount,
    toHex,
} from "viem";
import { createBundlerClient } from "viem/account-abstraction";
import { waitForTransactionReceipt } from "viem/actions";
import { useClient } from "wagmi";
import { recoveryKey } from "@/module/recovery/queryKeys/recovery";
import { doAddPassKeyFnAbi } from "@/module/recovery/utils/abi";
import { recoverySmartAccount } from "@/module/wallet/smartWallet/RecoverySmartWallet";

/** The freshly-created passkey we want to register on the recovered wallet. */
type RecoveryPasskey = {
    authenticatorId: string;
    publicKey: { x: Hex; y: Hex };
};

type MutationParams = {
    /** The wallet being recovered (decrypted from the recovery blob). */
    walletAddress: Address;
    /** Guardian account derived from the blob's burner private key. */
    recoveryAccount: LocalAccount<string>;
    /** The new passkey to push on-chain via `doAddPasskey`. */
    newPasskey: RecoveryPasskey;
};

/**
 * Push the new passkey onto the recovered wallet on-chain, signed by the
 * recovery guardian. Resolves once the user operation is included, so the
 * passkey is guaranteed registered on-chain when this returns.
 */
export function usePushRecoveryPasskey() {
    // Get the viem client for the given chain
    const client = useClient();

    const { mutateAsync, mutate, ...mutationStuff } = useMutation({
        mutationKey: recoveryKey.performRecovery,
        gcTime: 0,
        mutationFn: async ({
            walletAddress,
            recoveryAccount,
            newPasskey,
        }: MutationParams) => {
            if (!client) {
                throw new Error("No client found");
            }

            // Build the recovery account
            const smartAccount = await recoverySmartAccount(client, {
                localAccount: recoveryAccount,
                walletAddress,
            });

            // Get the bundler and paymaster clients
            const pimlicoTransport = getPimlicoTransport();
            const pimlicoClient = getPimlicoClient();

            // Build the smart wallet client
            const accountClient = createBundlerClient({
                account: smartAccount,
                chain: client.chain,
                transport: pimlicoTransport,
                // Get the right gas fees for the user operation
                userOperation: {
                    estimateFeesPerGas: async () => {
                        // Get gas price + direct estimation in //
                        const { standard } =
                            await getUserOperationGasPrice(pimlicoClient);
                        return standard;
                    },
                },
                paymaster: true,
            }).extend(smartAccountActions);

            // Build the function data
            const fnData = encodeFunctionData({
                abi: [doAddPassKeyFnAbi],
                functionName: "doAddPasskey",
                args: [
                    keccak256(toHex(newPasskey.authenticatorId)),
                    BigInt(newPasskey.publicKey.x),
                    BigInt(newPasskey.publicKey.y),
                ],
            });

            // Send the recovery transaction. `sendTransaction` already waits
            // for the userOp to be included, so the tx hash points at a mined tx.
            const txHash = await accountClient.sendTransaction({
                to: walletAddress,
                data: fnData,
            });

            // Wait for confirmations before returning so the backend claim
            // (/auth/recover), which reads the passkey back from the on-chain
            // validator, can't race ahead of inclusion.
            await waitForTransactionReceipt(currentViemClient, {
                hash: txHash,
                confirmations: 8,
            });

            return txHash;
        },
    });

    return {
        ...mutationStuff,
        pushRecoveryPasskeyAsync: mutateAsync,
        pushRecoveryPasskey: mutate,
    };
}
