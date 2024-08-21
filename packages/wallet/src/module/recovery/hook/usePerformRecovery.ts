import {
    getPimlicoClient,
    getPimlicoTransport,
} from "@/context/blockchain/aa-provider";
import { doAddPassKeyFnAbi } from "@/context/recover/utils/abi";
import { recoverySmartAccount } from "@/context/wallet/smartWallet/RecoverySmartWallet";
import type { RecoveryFileContent } from "@/types/Recovery";
import type { WebAuthNWallet } from "@/types/WebAuthN";
import { type DefaultError, useMutation } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import {
    ENTRYPOINT_ADDRESS_V06,
    createSmartAccountClient,
} from "permissionless";
import {
    getUserOperationGasPrice,
    sponsorUserOperation,
} from "permissionless/actions/pimlico";
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
        mutationKey: ["recovery", "perform-recovery"],
        gcTime: 0,
        mutationFn: async ({
            file,
            recoveryAccount,
            newWallet,
        }: MutationParams) => {
            if (!client) {
                throw new Error("No client found");
            }

            // TODO: We should ensure that the new wallet is different from the initial wallet

            // Build the recovery account
            // @ts-ignore: The useClient hook doesn't expose a client with the PublicRpcSchema, should be fixed
            const smartAccount = recoverySmartAccount(client, {
                localAccount: recoveryAccount,
                initialWallet: file.initialWallet,
            });

            // Get the bundler and paymaster clients
            const pimlicoTransport = getPimlicoTransport();
            const pimlicoClient = getPimlicoClient();

            // Build the smart wallet client
            const accountClient = createSmartAccountClient({
                account: smartAccount,
                entryPoint: ENTRYPOINT_ADDRESS_V06,
                chain: client.chain,
                bundlerTransport: pimlicoTransport,
                // Only add a middleware if the paymaster client is available
                middleware: {
                    sponsorUserOperation: async (args) => {
                        const { standard } =
                            await getUserOperationGasPrice(pimlicoClient);

                        // Update the gas prices
                        args.userOperation.maxFeePerGas = standard.maxFeePerGas;
                        args.userOperation.maxPriorityFeePerGas =
                            standard.maxPriorityFeePerGas;

                        // Sponsor the user operation
                        return sponsorUserOperation(pimlicoClient, args);
                    },
                },
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
