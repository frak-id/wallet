import { currentChain } from "@/context/blockchain/provider";
import {
    PrivyProvider,
    type User,
    useLogin,
    usePrivy,
    useWallets,
} from "@privy-io/react-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
    type PropsWithChildren,
    type ReactNode,
    useMemo,
    useState,
} from "react";
import { type Address, type Hex, isAddressEqual, zeroAddress } from "viem";
import { PrivyContext, PrivySessionSyncer } from "./PrivyProvider";

/**
 * Export the privy Wallet provider
 * @constructor
 */
export function PrivyWalletProvider({ children }: { children: ReactNode }) {
    return (
        <PrivyProviderWithConfig>
            <InnerPrivyWalletProvider>
                <PrivySessionSyncer />
                {children}
            </InnerPrivyWalletProvider>
        </PrivyProviderWithConfig>
    );
}

function PrivyProviderWithConfig({ children }: PropsWithChildren) {
    return (
        <PrivyProvider
            appId={process.env.PRIVY_APP_ID ?? ""}
            config={{
                // Customize Privy's appearance in your app
                appearance: {
                    theme: "light",
                    accentColor: "#676FFF",
                    logo: "https://wallet.frak.id/icon-192.png",
                    walletChainType: "ethereum-only",
                },
                embeddedWallets: {
                    // Create wallet on login for user who don't have one
                    createOnLogin: "users-without-wallets",
                },
                supportedChains: [currentChain],
                defaultChain: currentChain,
            }}
        >
            {children}
        </PrivyProvider>
    );
}

function InnerPrivyWalletProvider({ children }: PropsWithChildren) {
    const { ready, logout, user, authenticated } = usePrivy();
    const { wallets } = useWallets();

    // Small promise wrapper to map the login callback stuff to a mutation
    const [loginPromise, setLoginPromise] = useState<{
        resolve?: (value: User) => void;
        reject?: (reason?: Error) => void;
    }>({});

    // Privy login, using the promise wrapper to send back the results to the mutation
    const { login: baseLogin } = useLogin({
        onComplete(user) {
            loginPromise.resolve?.(user);
        },
        onError(errorCode) {
            loginPromise.reject?.(new Error(`Login failed: ${errorCode}`));
        },
    });
    /**
     * Launch a login process
     */
    const { mutateAsync: login } = useMutation({
        mutationKey: ["privy", "login"],
        async mutationFn() {
            // Check if we got a user already
            if (wallet) {
                return wallet;
            }

            // Set the new login promise
            const loginPromise = new Promise<User>((resolve, reject) => {
                setLoginPromise({
                    resolve,
                    reject,
                });
            });

            // Trigger the login
            baseLogin();

            // Wait for the login to complete
            const user = await loginPromise;

            // Ensure the user got a wallet
            if (!user.wallet) {
                throw new Error("No wallet found");
            }

            return user.wallet.address as Address;
        },
    });

    /**
     * Get the current wallet address
     */
    const { data: wallet } = useQuery({
        queryKey: [
            "privy",
            "wallet",
            authenticated,
            user?.id ?? "no-user",
            user?.wallet?.address ?? "no-wallet",
        ],
        enabled: ready,
        queryFn() {
            if (!ready) return null;
            if (!authenticated) return null;
            if (!user?.wallet?.address) return null;

            // Ensure the user wallet address is present in the wallets
            const wallet = wallets.find((w) =>
                isAddressEqual(
                    w.address as Address,
                    (user?.wallet?.address ?? zeroAddress) as Address
                )
            );
            if (!wallet) {
                throw new Error("Wallet not found");
            }

            return user.wallet.address as Address;
        },
        refetchOnMount: "always",
        refetchOnWindowFocus: "always",
    });

    /**
     * Launch a sign message process
     */
    const { mutateAsync: signMessage } = useMutation({
        mutationKey: ["privy", "sign-message", wallet],
        async mutationFn({ hash, address }: { hash: Hex; address: Address }) {
            // // Find a wallet matching the address
            const matchingWallet = wallets.find((w) =>
                isAddressEqual(w.address as Address, address)
            );
            if (!matchingWallet) {
                throw new Error("Wallet not found");
            }
            await matchingWallet.switchChain(currentChain.id);

            // Get the wallet provider
            const provider = await matchingWallet.getEthereumProvider();

            // Send the signature request
            const signature = await provider.request({
                method: "personal_sign",
                params: [hash, address],
            });

            // const signature = await baseSignMessage(
            //     hash,
            //     {
            //         showWalletUIs: true,
            //         title: "Validate the action",
            //         description:
            //             "Sign the following message to validate the current Frak action",
            //     },
            //     // address
            // );
            if (!signature) {
                throw new Error("No signature returned");
            }
            return signature as Hex;
        },
    });

    const context = useMemo(
        () => ({
            ready,
            wallet: wallet ?? undefined,
            login,
            signMessage,
            logout,
        }),
        [ready, wallet, login, logout, signMessage]
    );

    return (
        <PrivyContext.Provider value={context}>
            {children}
        </PrivyContext.Provider>
    );
}
