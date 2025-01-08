import { currentChain } from "@/context/blockchain/provider";
import { useSyncEcdsaSession } from "@/module/common/hook/useSyncEcdsaSession";
import Privy, {
    getUserEmbeddedEthereumWallet,
    LocalStorage,
    type PrivyEmbeddedWalletProvider,
} from "@privy-io/js-sdk-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    type PropsWithChildren,
    createContext,
    useContext,
    useMemo,
} from "react";
import {
    type Address,
    type Hex,
    createWalletClient,
    custom,
    toHex,
} from "viem";

/**
 * A shared privy context, with some base stuff depending on the implementation
 *  - Can be implemented by the privy embedded client (wallet context)
 *  - Or via the privy cross app client (SDK context)
 */
export type PrivyContextType = {
    /**
     * Is the SDK rdy to handle requests
     */
    ready: boolean;
    /**
     * The current privy client
     */
    client: Privy;
    /**
     * The current logged in wallet
     */
    wallet?: Address;
    /**
     * Sign a message via privy
     * @param args
     */
    signMessage: (args: { hash: Hex; address: Address }) => Promise<Hex>;
    /**
     * Launch the logout process
     */
    logout: () => Promise<void>;
};

export const PrivyContext = createContext<PrivyContextType | undefined>(
    undefined
);

export const usePrivyContext = () => {
    const context = useContext(PrivyContext);
    if (!context) {
        throw new Error(
            "usePrivy must be used within a PrivyWalletProvider or PrivySdkProvider"
        );
    }
    return context;
};

/**
 * Export the core privy provider
 * @constructor
 */
export function PrivyProvider({ children }: PropsWithChildren) {
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
        enabled: !!client,
        queryKey: ["privy-core", "user"],
        async queryFn() {
            console.log("Launching user query");
            try {
                const { user } = await client.user.get();
                return user ?? null;
            } catch (e) {
                console.warn("Unable to get the user", e);
                return null;
            }
        },
        refetchOnMount: "always",
        refetchOnWindowFocus: "always",
    });

    /**
     * Get the current wallet address
     */
    const { data: provider } = useQuery({
        enabled: !!client && !!user,
        queryKey: ["privy-core", "provider"],
        async queryFn() {
            // Case of the user is not connected
            if (!user) {
                return null;
            }

            // Check if the user has an embedded wallet, if not, create one
            console.log("Checking user wallet");
            let provider: PrivyEmbeddedWalletProvider;
            const hasWallet = await client.embeddedWallet.hasEmbeddedWallet();
            if (!hasWallet) {
                console.log("Creating user wallet");
                const { provider: freshProvider } =
                    await client.embeddedWallet.create();
                provider = freshProvider;
            } else {
                console.log("Fetching wallet provider");
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

    /**
     * Synchronise the session with the ecdsa session
     */
    useSyncEcdsaSession(context);

    return (
        <PrivyContext.Provider value={context}>
            {children}
        </PrivyContext.Provider>
    );
}
