"use client";

import { getSignOptions } from "@/context/wallet/action/sign";
import {
    type KernelWebAuthNSmartAccount,
    webAuthNSmartAccount,
} from "@/context/wallet/smartWallet/WebAuthNSmartWallet";
import { parseWebAuthNAuthentication } from "@/context/wallet/smartWallet/webAuthN";
import { useAAClients } from "@/module/common/hook/useAAClients";
import type { Session } from "@/types/Session";
import { smartAccount } from "@permissionless/wagmi";
import { startAuthentication } from "@simplewebauthn/browser";
import { useQuery } from "@tanstack/react-query";
import {
    ENTRYPOINT_ADDRESS_V06,
    createSmartAccountClient,
} from "permissionless";
import { sponsorUserOperation } from "permissionless/actions/pimlico";
import { type ReactNode, createContext, useContext } from "react";
import { useMemo } from "react";
import { useClient, useConnect } from "wagmi";

function useWalletHook({ session }: { session: Session }) {
    /**
     * Current user session
     */
    const { wallet, username } = session;

    /**
     * The current viem client
     */
    const viemClient = useClient();

    /**
     * The current AA related clients
     */
    const { bundlerTransport, bundlerClient, paymasterClient } = useAAClients();

    /**
     * Hook to connect the wagmi connector to the smart wallet client
     */
    const { connect } = useConnect();

    /**
     * The current smart wallet
     */
    const { data: smartWallet } = useQuery({
        queryKey: [
            "kernel-smartWallet",
            wallet?.authenticatorId ?? "no-authenticator-id",
            viemClient?.key ?? "no-viem-key",
            viemClient?.chain?.id ?? "no-viem-chain-id",
        ],
        queryFn: async (): Promise<KernelWebAuthNSmartAccount | null> => {
            console.log("rebuilding smartWallet", {
                wallet,
                viemClient,
                chain: viemClient?.chain?.name,
            });
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
    });

    /**
     * The smart wallet client
     */
    const { data: smartWalletClient } = useQuery({
        queryKey: [
            "kernel-smartWallet-client",
            smartWallet?.address ?? "no-address",
            viemClient,
            bundlerTransport,
            paymasterClient,
        ],
        enabled:
            !!smartWallet &&
            !!viemClient &&
            !!bundlerTransport &&
            !!bundlerClient &&
            viemClient.chain.id === bundlerClient.chain.id,
        queryFn: async () => {
            if (!(smartWallet && viemClient && bundlerTransport)) {
                return;
            }

            // Build the smart wallet client
            const smartAccountClient = createSmartAccountClient({
                account: smartWallet,
                entryPoint: ENTRYPOINT_ADDRESS_V06,
                chain: viemClient.chain,
                bundlerTransport,
                // Only add a middleware if the paymaster client is available
                middleware: paymasterClient
                    ? {
                          sponsorUserOperation: (args) =>
                              sponsorUserOperation(paymasterClient, args),
                      }
                    : {},
            });

            // Build the wagmi connector and connect to it
            const connector = smartAccount({
                // @ts-ignore
                smartAccountClient,
            });
            connect({ connector });

            // Return it
            return smartAccountClient;
        },
    });

    return useMemo(
        () => ({
            address: smartWallet?.address,
            smartWallet,
            smartWalletClient,
            // Current session related
            username,
            wallet,
        }),
        [smartWallet, smartWalletClient, username, wallet]
    );
}

type UseWalletHook = ReturnType<typeof useWalletHook>;
const WalletContext = createContext<UseWalletHook | null>(null);

export const useWallet = (): UseWalletHook => {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error("useWallet hook must be used within a WalletProvider");
    }
    return context;
};

export function WalletProvider({
    session,
    children,
}: { session: Session; children: ReactNode }) {
    const hook = useWalletHook({ session });

    return (
        <WalletContext.Provider value={hook}>{children}</WalletContext.Provider>
    );
}
