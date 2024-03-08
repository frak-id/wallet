"use client";

import { addresses } from "@/context/common/blockchain/addresses";
import { frakTokenAbi } from "@/context/common/blockchain/frak-abi";
import {
    pimlicoBundlerTransport,
    pimlicoPaymasterClient,
} from "@/context/common/blockchain/provider";
import type { KernelWebAuthNSmartAccount } from "@/context/wallet/smartWallet/WebAuthNSmartWallet";
import { buildSmartWallet } from "@/context/wallet/utils/buildSmartWallet";
import type { Session } from "@/types/Session";
import { smartAccount } from "@permissionless/wagmi";
import {
    ENTRYPOINT_ADDRESS_V06,
    createSmartAccountClient,
} from "permissionless";
import { sponsorUserOperation } from "permissionless/actions/pimlico";
import {
    type ReactNode,
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";
import { useMemo } from "react";
import { formatEther } from "viem";
import { polygonMumbai } from "viem/chains";
import { useConnect, useReadContract } from "wagmi";

function useWalletHook({ session }: { session: Session }) {
    const { wallet, username } = session;
    const {
        connect,
        status: connectStatus,
        error: connectError,
    } = useConnect();

    // The current user smart wallet
    const [smartWallet, setSmartWallet] =
        useState<KernelWebAuthNSmartAccount | null>();

    // Listen to the smart wallet FRK balance
    const { data: balance, refetch: refreshBalance } = useReadContract({
        abi: frakTokenAbi,
        address: addresses.frakToken,
        functionName: "balanceOf",
        args: [smartWallet?.address ?? "0x0"],
        // Get the data on the pending block, to get the fastest possible data
        blockTag: "pending",
        // Some query options
        query: {
            // Only enable the hook if the smart wallet is present
            enabled: !!smartWallet,
            // Refetch every minute, will be available once wagmi is updated (and should then be moved into a query sub object)
            refetchInterval: 60_000,
        },
    });

    /**
     * Every time the authenticator changes, rebuild the smart wallet and refresh the balance
     */
    useEffect(() => {
        refreshSmartWallet(wallet);
    }, [wallet]);

    async function refreshSmartWallet(wallet: Session["wallet"]) {
        // If there is no authenticator, return
        if (!wallet) {
            setSmartWallet(null);
            return;
        }

        // Build our smart wallet
        const smartWallet = await buildSmartWallet({
            authenticatorId: wallet.authenticatorId,
            publicKey: wallet.publicKey,
        });
        setSmartWallet(smartWallet);

        // If there is no smart wallet, return
        if (!smartWallet) {
            return;
        }

        // Otherwise, build the wagmi connector
        const client = createSmartAccountClient({
            account: smartWallet,
            entryPoint: ENTRYPOINT_ADDRESS_V06,
            chain: polygonMumbai,
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
    }

    return useMemo(() => {
        return {
            address: smartWallet?.address,
            balance: formatEther(balance ?? 0n),
            smartWallet,
            refreshBalance,
            // Stuff related to the wagmi connector
            connectStatus,
            connectError,
            username,
            wallet,
        };
    }, [
        smartWallet,
        balance,
        refreshBalance,
        connectStatus,
        connectError,
        username,
        wallet,
    ]);
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
