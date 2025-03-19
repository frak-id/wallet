import {
    getPimlicoClient,
    getPimlicoTransport,
} from "@/module/blockchain/aa-provider";
import { recoveryMutationKeys } from "@/module/recovery/queryKeys/recovery";
import { doAddPassKeyFnAbi } from "@/module/recovery/utils/abi";
import { recoverySmartAccount } from "@/module/wallet/smartWallet/RecoverySmartWallet";
import type { RecoveryFileContent } from "@/types/Recovery";
import type { WebAuthNWallet } from "@/types/WebAuthN";
import { type DefaultError, useMutation } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { createSmartAccountClient } from "permissionless";
import { getUserOperationGasPrice } from "permissionless/actions/pimlico";
import {
    type Hex,
    type LocalAccount,
    encodeFunctionData,
    keccak256,
    toHex,
} from "viem";
import { useClient } from "wagmi";

type MutationParams = {
    file: RecoveryFileContent;
    recoveryAccount: LocalAccount<string>;
    newWallet: Omit<WebAuthNWallet, "address">;
};

/**
 * Perform the recovery on the given chain
 * Steps for recovery
 *  - Upload the recovery file
 *  - Perform a test using the `useLogin` hook to try to do a softRecover (passing wallet address and authenticator id from the file as param)
 *  - If login good, then proceed as usual
 *  - Create a webauthn authenticator
 *  - Enter file passphrase
 *  - Decrypt the guardian private key and build local account
 *  - Display options to recover the wallet on every deployed chains
 */
export function usePerformRecovery(
    options?: UseMutationOptions<Hex, DefaultError, MutationParams>
) {
    // Get the viem client for the given chain
    const client = useClient();

    const { mutateAsync, mutate, ...mutationStuff } = useMutation({
        ...options,
        mutationKey: recoveryMutationKeys.performRecovery,
        gcTime: 0,
        mutationFn: async ({
            file,
            recoveryAccount,
            newWallet,
        }: MutationParams) => {
            if (!client) {
                throw new Error("No client found");
            }

            // Build the recovery account
            const smartAccount = await recoverySmartAccount(client, {
                localAccount: recoveryAccount,
                initialWallet: file.initialWallet,
            });

            // Get the bundler and paymaster clients
            const pimlicoTransport = getPimlicoTransport();
            const pimlicoClient = getPimlicoClient();

            // Build the smart wallet client
            const accountClient = createSmartAccountClient({
                account: smartAccount,
                chain: client.chain,
                bundlerTransport: pimlicoTransport,
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
            });

            // Build the function data
            const fnData = encodeFunctionData({
                abi: [doAddPassKeyFnAbi],
                functionName: "doAddPasskey",
                args: [
                    keccak256(toHex(newWallet.authenticatorId)),
                    BigInt(newWallet.publicKey.x),
                    BigInt(newWallet.publicKey.y),
                ],
            });

            // Then send the recovery transaction and return the tx hash
            return await accountClient.sendTransaction({
                to: file.initialWallet.address,
                data: fnData,
            });
        },
    });

    return {
        ...mutationStuff,
        performRecoveryAsync: mutateAsync,
        performRecovery: mutate,
    };
}
