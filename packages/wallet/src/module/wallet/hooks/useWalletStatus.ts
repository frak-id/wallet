"use client";

import { addresses } from "@/context/common/blockchain/addresses";
import { frakTokenAbi } from "@/context/common/blockchain/frak-abi";
import { useSession } from "@/module/common/hook/useSession";
import type { WalletStatusReturnType } from "@frak-wallet/sdk/core";
import { useQuery } from "@tanstack/react-query";
import { toHex } from "viem";
import { useReadContract } from "wagmi";

export function useWalletStatus() {
    // Get the current session
    const { session, isFetchingSession } = useSession();

    // Listen to the smart wallet FRK balance
    const { data: walletBalance, isLoading: isFetchingBalance } =
        useReadContract({
            abi: frakTokenAbi,
            address: addresses.frakToken,
            functionName: "balanceOf",
            args: [session?.wallet?.address ?? "0x0"],
            blockTag: "pending",
            // Some query options
            query: {
                enabled: !isFetchingSession && !!session,
                refetchInterval: 60_000,
            },
        });

    // Query the user balance if a session is present
    const { data: userStatus } = useQuery({
        queryKey: [
            "userState",
            session?.wallet?.address ?? "no-wallet",
            toHex(walletBalance ?? 0n),
        ],
        queryFn: async (): Promise<WalletStatusReturnType> => {
            const wallet = session?.wallet?.address;

            // If no wallet present, just return the not logged in status
            if (!wallet) {
                return {
                    key: "not-connected",
                };
            }

            // Otherwise, return hte logged in status
            return {
                key: "connected",
                wallet,
                frkBalanceAsHex: toHex(walletBalance ?? 0n),
            };
        },
        enabled: !(isFetchingSession || isFetchingBalance),
        refetchOnMount: "always",
    });

    return {
        walletStatus: userStatus,
    };
}
