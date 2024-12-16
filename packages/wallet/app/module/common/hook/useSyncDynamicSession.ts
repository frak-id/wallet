import {
    dynamicSessionAtom,
    sdkSessionAtom,
    sessionAtom,
} from "@/module/common/atoms/session";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { jotaiStore } from "@module/atoms/store";
import { useAtomValue } from "jotai";
import { RESET } from "jotai/utils";
import { useEffect } from "react";
import { type Address, isAddressEqual } from "viem";

/**
 * Hook that synchronise the dynamic session
 */
export function useSyncDynamicSession() {
    const { sdkHasLoaded, primaryWallet } = useDynamicContext();
    const dynamicSession = useAtomValue(dynamicSessionAtom);

    useEffect(() => {
        if (!sdkHasLoaded) return;
        if (!primaryWallet) return;
        if (!dynamicSession) return;

        // Check if the wallet match the current session
        if (
            isAddressEqual(
                primaryWallet.address as Address,
                dynamicSession.publicKey
            )
        )
            return;

        // If no wallet match, we reset the current user session
        jotaiStore.set(sessionAtom, RESET);
        jotaiStore.set(sdkSessionAtom, RESET);
    }, [dynamicSession, sdkHasLoaded, primaryWallet]);
}
