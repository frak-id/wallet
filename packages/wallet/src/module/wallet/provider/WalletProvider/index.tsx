"use client";

import {
    pimlicoBundlerTransport,
    pimlicoPaymasterClient,
} from "@/context/common/blockchain/provider";
import { getSignOptions } from "@/context/wallet/action/sign";
import {
    type KernelWebAuthNSmartAccount,
    webAuthNSmartAccount,
} from "@/context/wallet/smartWallet/WebAuthNSmartWallet";
import { parseWebAuthNAuthentication } from "@/context/wallet/smartWallet/webAuthN";
import type { Session } from "@/types/Session";
import { smartAccount } from "@permissionless/wagmi";
import { startAuthentication } from "@simplewebauthn/browser";
import { useQuery } from "@tanstack/react-query";
import {
    ENTRYPOINT_ADDRESS_V06,
    createSmartAccountClient,
} from "permissionless";
import { sponsorUserOperation } from "permissionless/actions/pimlico";
import { type ReactNode, createContext, useContext, useEffect } from "react";
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
     * Hook to connect the wagmi connector to the smart wallet client
     */
    const {
        connect,
        status: connectStatus,
        error: connectError,
    } = useConnect();

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
     * Every time the smart wallet changes, update the wagmi connector
     */
    useEffect(() => {
        if (!(smartWallet && viemClient)) {
            return;
        }

        // Find the right chain
        const chain = viemClient.chain;
        if (!chain) {
            console.error(`Chain of ${viemClient.key} not found`);
            return;
        }

        // Build the wagmi connector
        // TODO: Dynamic bundler and paymaster depending on the chain
        const client = createSmartAccountClient({
            account: smartWallet,
            entryPoint: ENTRYPOINT_ADDRESS_V06,
            chain,
            bundlerTransport: pimlicoBundlerTransport,
            middleware: {
                sponsorUserOperation: (args) =>
                    sponsorUserOperation(pimlicoPaymasterClient, args),
            },
        });

        // Build the wagmi connector and connect to it
        const connector = smartAccount({
            // @ts-ignore
            smartAccountClient: client,
        });
        connect({ connector });
    }, [smartWallet, viemClient, connect]);

    return useMemo(() => {
        return {
            address: smartWallet?.address,
            smartWallet,
            // Stuff related to the wagmi connector
            connectStatus,
            connectError,
            username,
            wallet,
        };
    }, [smartWallet, connectStatus, connectError, username, wallet]);
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
