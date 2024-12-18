import { crossAppClient } from "@/context/blockchain/privy-cross-client";

export const crossAppWalletQuery = {
    queryKey: ["privy-cross-app", "wallet"],
    queryFn() {
        return crossAppClient.address;
    },
} as const;

export const isCrossAppWalletLoggedInQuery = {
    queryKey: ["privy-cross-app", "isLoggedIn"],
    queryFn() {
        return crossAppClient.address;
    },
} as const;
