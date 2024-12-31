import { currentChain } from "@/context/blockchain/provider";
import { createPrivyCrossAppClient } from "@privy-io/cross-app-connect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useMemo } from "react";
import type { Address, Hex } from "viem";
import { PrivyContext } from "./PrivyProvider";

/**
 * Export the privy SDK provider
 * @constructor
 */
export function PrivySdkProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();

    /**
     * Build the privy cross app client
     */
    const client = useMemo(
        () =>
            createPrivyCrossAppClient({
                // todo: Should be migrated to the Frak provider app id
                providerAppId: "cm04asygd041fmry9zmcyn5o5",
                chains: [currentChain],
                chainId: currentChain.id,
                connectionOpts: {
                    smartWalletMode: false,
                },
                // @ts-ignore, not in option spec but used in the implementation
                apiUrl: "https://auth.privy.io",
            }),
        []
    );

    /**
     * Get the current wallet address
     */
    const { data: wallet, status: walletStatus } = useQuery({
        queryKey: ["privy-cross-app", "wallet"],
        queryFn() {
            return client.address ?? null;
        },
        refetchOnMount: "always",
        refetchOnWindowFocus: "always",
    });

    /**
     * Launch a login process
     */
    const { mutateAsync: login } = useMutation({
        mutationKey: ["privy-cross-app", "login"],
        async mutationFn() {
            let wallet = client.address;
            if (!wallet) {
                // If we don't have a wallet, request a connection
                await client.requestConnection();
                await queryClient.invalidateQueries({
                    queryKey: ["privy-cross-app"],
                    exact: false,
                });
                wallet = client.address;
            }

            if (!wallet) {
                throw new Error("No wallet selected");
            }

            return wallet;
        },
    });

    /**
     * Launch a logout process
     */
    const { mutateAsync: logout } = useMutation({
        mutationKey: ["privy-cross-app", "logout"],
        async mutationFn() {
            client.clearConnection();
            await queryClient.invalidateQueries({
                queryKey: ["privy-cross-app"],
                exact: false,
            });
        },
    });

    /**
     * Launch a sign message process
     */
    const { mutateAsync: signMessage } = useMutation({
        mutationKey: ["privy-cross-app", "sign-message", wallet],
        async mutationFn({ hash, address }: { hash: Hex; address: Address }) {
            const signature = await client.sendRequest("personal_sign", [
                hash,
                address,
            ]);
            if (!signature) {
                throw new Error("No signature returned");
            }
            return signature as Hex;
        },
    });

    const context = useMemo(
        () => ({
            ready: client !== undefined && walletStatus !== "pending",
            wallet: wallet ?? undefined,
            login,
            signMessage,
            logout,
        }),
        [client, wallet, walletStatus, login, logout, signMessage]
    );

    return (
        <PrivyContext.Provider value={context}>
            {children}
        </PrivyContext.Provider>
    );
}
