import { getSignOptions } from "@/context/wallet/action/sign";
import {
    type KernelWebAuthNSmartAccount,
    webAuthNSmartAccount,
} from "@/context/wallet/smartWallet/WebAuthNSmartWallet";
import { parseWebAuthNAuthentication } from "@/context/wallet/smartWallet/webAuthN";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { startAuthentication } from "@simplewebauthn/browser";
import { useQuery } from "@tanstack/react-query";
import { ENTRYPOINT_ADDRESS_V06 } from "permissionless";
import { useChainId, useClient } from "wagmi";

/**
 * Use a chain specific wallet
 * @param chainId
 */
export function useChainSpecificSmartWallet({ chainId }: { chainId?: number }) {
    const currentChainId = useChainId();
    const { wallet, smartWallet: initialSmartWallet } = useWallet();

    // Get the right viem client for the given chain
    const viemClient = useClient({ chainId });

    /**
     * The current smart wallet
     */
    const { data: smartWallet } = useQuery({
        queryKey: [
            "kernel-chain-specific-smart-wallet",
            wallet?.authenticatorId ?? "no-authenticator-id",
            viemClient?.key ?? "no-viem-key",
            viemClient?.chain?.id ?? "no-viem-chain-id",
            initialSmartWallet?.address ?? "no-initial-smart-wallet-address",
        ],
        queryFn: async (): Promise<KernelWebAuthNSmartAccount | null> => {
            // If on the same chain, return directly
            if (currentChainId === chainId || !chainId) {
                return initialSmartWallet ?? null;
            }

            // If there is no authenticator, return
            if (!(wallet && viemClient)) {
                return null;
            }

            const { authenticatorId, publicKey } = wallet;

            // Build the user smart wallet
            return await webAuthNSmartAccount(viemClient, {
                entryPoint: ENTRYPOINT_ADDRESS_V06,
                authenticatorId,
                signerPubKey: publicKey,
                signatureProvider: async (message) => {
                    // Get the signature options from server
                    const options = await getSignOptions({
                        authenticatorId,
                        toSign: message,
                    });

                    // Start the client authentication
                    const authenticationResponse =
                        await startAuthentication(options);

                    // Perform the verification of the signature
                    return parseWebAuthNAuthentication(authenticationResponse);
                },
            });
        },
        enabled: !!viemClient,
        staleTime: 0,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        refetchOnReconnect: true,
    });

    return { wallet, smartWallet };
}
