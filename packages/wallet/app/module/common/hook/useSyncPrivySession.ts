import {
    privySessionAtom,
    sdkSessionAtom,
    sessionAtom,
} from "@/module/common/atoms/session";
import { jotaiStore } from "@module/atoms/store";
import { useWallets } from "@privy-io/react-auth";
import { useAtomValue } from "jotai";
import { RESET } from "jotai/utils";
import { useEffect } from "react";
import { type Address, isAddressEqual } from "viem";

/**
 * Hook that synchronise the privy session
 */
export function useSyncPrivySession() {
    const privySession = useAtomValue(privySessionAtom);
    const { wallets: privyWallets, ready } = useWallets();

    useEffect(() => {
        if (!ready) return;
        if (!privySession) return;

        // Find a privy wallets that match the current session
        const wallet = privyWallets.find((w) =>
            isAddressEqual(w.address as Address, privySession.publicKey)
        );
        if (wallet) return;

        // If no wallet match, we reset the current user session
        jotaiStore.set(sessionAtom, RESET);
        jotaiStore.set(sdkSessionAtom, RESET);
    }, [privySession, privyWallets, ready]);
}
