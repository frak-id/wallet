import {
    dynamicSessionAtom,
    sdkSessionAtom,
    sessionAtom,
} from "@/module/common/atoms/session";
import { isEthereumWallet } from "@dynamic-labs/ethereum";
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

        // If that's not an ethereum wallet, early reset
        if (!isEthereumWallet(primaryWallet)) {
            jotaiStore.set(sessionAtom, RESET);
            jotaiStore.set(sdkSessionAtom, RESET);
            return;
        }

        // If the addresses doesn't match, early reset
        if (
            !isAddressEqual(
                primaryWallet.address as Address,
                dynamicSession.publicKey
            )
        ) {
            jotaiStore.set(sessionAtom, RESET);
            jotaiStore.set(sdkSessionAtom, RESET);
            return;
        }

        // Otherwise, nothing to do
    }, [dynamicSession, sdkHasLoaded, primaryWallet]);
}
