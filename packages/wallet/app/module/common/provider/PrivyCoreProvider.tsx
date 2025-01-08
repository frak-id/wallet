import { currentChain } from "@/context/blockchain/provider";
import Privy, {
    getUserEmbeddedEthereumWallet,
    LocalStorage,
    type PrivyEmbeddedWalletProvider,
} from "@privy-io/js-sdk-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    type PropsWithChildren,
    createElement,
    useCallback,
    useMemo,
} from "react";
import {
    type Address,
    type Hex,
    createWalletClient,
    custom,
    toHex,
} from "viem";
import { PrivyContext, PrivySessionSyncer } from "./PrivyProvider";

/**
 * Export the privy SDK provider
 * @constructor
 */
export function PrivyCoreProvider({ children }: PropsWithChildren) {
    const queryClient = useQueryClient();

    /**
     * Build the privy cross app client
     * todo: In the Wallet context, directly create and embed privy iframe here
     */
    const client = useMemo(
        () =>
            new Privy({
                appId: process.env.PRIVY_APP_ID ?? "",
                storage: new LocalStorage(),
                supportedChains: [currentChain],
            }),
        []
    );

    /**
     * Get the current wallet address
     */
    const { data: user } = useQuery({
        queryKey: ["privy-core", "user"],
        async queryFn() {
            const { user } = await client.user.get();
            return user ?? null;
        },
        refetchOnMount: "always",
        refetchOnWindowFocus: "always",
    });

    /**
     * Register the privy iframe
     */
    const setIframe = useCallback(
        (iframe: HTMLIFrameElement) => {
            if (!(iframe?.contentWindow && client)) {
                return;
            }
            // Set the message poster for the client
            client.setMessagePoster({
                postMessage: (data, targetOrigin) =>
                    iframe.contentWindow?.postMessage(data, targetOrigin),
            });
            // Add the client's message handler as a event listener
            window.addEventListener("message", (e: MessageEvent) =>
                client.embeddedWallet.onMessage(e.data)
            );
        },
        [client]
    );

    // Create the iframe that will be used to communicate with the wallet
    const iFrame = createElement("iframe", {
        src: client.embeddedWallet.getURL(),
        ref: (iframe: HTMLIFrameElement) => {
            if (!iframe || client) {
                return;
            }
            setIframe(iframe);
        },
    });

    /**
     * Get the current wallet address
     */
    const { data: provider } = useQuery({
        queryKey: ["privy-core", "provider"],
        async queryFn() {
            // Case of the user is not connected
            if (!user) {
                return null;
            }

            // Check if the user has an embedded wallet, if not, create one
            let provider: PrivyEmbeddedWalletProvider;
            const hasWallet = await client.embeddedWallet.hasEmbeddedWallet();
            if (!hasWallet) {
                const { provider: freshProvider } =
                    await client.embeddedWallet.create();
                provider = freshProvider;
            } else {
                const embeddedWallet = getUserEmbeddedEthereumWallet(user);
                if (!embeddedWallet) {
                    console.warn("Unable to get the user embedded wallet");
                    return null;
                }
                provider =
                    await client.embeddedWallet.getProvider(embeddedWallet);
            }

            // Switch to the current chain
            await provider.request({
                method: "wallet_switchEthereumChain",
                // Replace '0x1' with the chain ID of your desired network
                params: [{ chainId: toHex(currentChain.id) }],
            });

            // Return the viem wallet client for this provider
            return createWalletClient({
                // Replace this with your desired network that you imported from viem
                chain: currentChain,
                transport: custom(provider),
            });
        },
        refetchOnMount: "always",
        refetchOnWindowFocus: "always",
    });

    /**
     * Get the current wallet address
     */
    const { data: wallet, status: walletStatus } = useQuery({
        enabled: !!provider,
        queryKey: ["privy-core", "wallet"],
        async queryFn() {
            if (!provider) {
                return null;
            }

            // Get the privy addresses
            const addresses = await provider.getAddresses();
            if (!addresses.length) {
                return null;
            }

            return addresses[0];
        },
        refetchOnMount: "always",
        refetchOnWindowFocus: "always",
    });

    /**
     * Launch a logout process
     */
    const { mutateAsync: logout } = useMutation({
        mutationKey: ["privy-core", "logout"],
        async mutationFn() {
            await client.auth.logout();
            await queryClient.invalidateQueries({
                queryKey: ["privy-core"],
                exact: false,
            });
        },
    });

    /**
     * Launch a sign message process
     */
    const { mutateAsync: signMessage } = useMutation({
        mutationKey: ["privy-core", "sign-message", wallet],
        async mutationFn({ hash, address }: { hash: Hex; address: Address }) {
            if (!provider) {
                throw new Error("No provider found");
            }
            const signature = await provider.signMessage({
                account: address,
                message: { raw: hash },
            });
            if (!signature) {
                throw new Error("No signature returned");
            }
            return signature;
        },
    });

    const context = useMemo(
        () => ({
            ready: client !== undefined && walletStatus !== "pending",
            client: client,
            wallet: wallet ?? undefined,
            signMessage,
            logout,
        }),
        [client, wallet, walletStatus, logout, signMessage]
    );

    return (
        <PrivyContext.Provider value={context}>
            {iFrame}
            <PrivySessionSyncer />
            {children}
        </PrivyContext.Provider>
    );
}
