import {
    getBundlerClient,
    getPaymasterClient,
} from "@/context/blockchain/aa-provider";
import { doAddPassKeyFnAbi } from "@/context/recover/utils/abi";
import { recoverySmartAccount } from "@/context/wallet/smartWallet/RecoverySmartWallet";
import type { RecoveryFileContent } from "@/types/Recovery";
import type { WebAuthNWallet } from "@/types/WebAuthN";
import { useMutation } from "@tanstack/react-query";
import {
    ENTRYPOINT_ADDRESS_V06,
    createSmartAccountClient,
} from "permissionless";
import { sponsorUserOperation } from "permissionless/actions/pimlico";
import { type LocalAccount, encodeFunctionData, keccak256, toHex } from "viem";
import { useClient } from "wagmi";

/**
 * Perform the recovery on the given chain
 * Steps for recovery
 *  - Upload the recovery file -> TODO
 *  - Perform a test using the `useLogin` hook to try to do a softRecover (passing wallet address and authenticator id from the file as param)  -> TODO
 *  - If login good, then proceed as usual  -> TODO
 *  - Create a webauthn authenticator  -> Hook op
 *  - Enter file passphrase -> TODO
 *  - Decrypt the guardian private key and build local account -> Hook op
 *  - Display options to recover the wallet on every deployed chains -> Hook op
 */
export function usePerformRecoveryOnChain(chainId: number) {
    // Get the viem client for the given chain
    const client = useClient({ chainId });

    const { mutateAsync, mutate, ...mutationStuff } = useMutation({
        mutationKey: ["recovery", "perform-recovery", chainId],
        gcTime: 0,
        mutationFn: async ({
            file,
            recoveryAccount,
            newWallet,
        }: {
            file: RecoveryFileContent;
            recoveryAccount: LocalAccount<string>;
            newWallet: Omit<WebAuthNWallet, "address">;
        }) => {
            if (!client) {
                throw new Error(`No client found for chain ${chainId}`);
            }

            // TODO: We should ensure that the new wallet is different from the initial wallet

            // Build the recovery account
            const smartAccount = recoverySmartAccount(client, {
                localAccount: recoveryAccount,
                initialWallet: file.initialWallet,
            });

            // Get the bundler and paymaster clients
            const { bundlerTransport } = getBundlerClient(client.chain);
            const paymasterClient = getPaymasterClient(client.chain);

            // Build the smart wallet client
            const accountClient = createSmartAccountClient({
                account: smartAccount,
                entryPoint: ENTRYPOINT_ADDRESS_V06,
                chain: client.chain,
                bundlerTransport,
                // Only add a middleware if the paymaster client is available
                middleware: {
                    sponsorUserOperation: (args) =>
                        sponsorUserOperation(paymasterClient, args),
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
