import {
    ecdsaSessionAtom,
    sdkSessionAtom,
    sessionAtom,
} from "@/module/common/atoms/session";
import { crossAppWalletQuery } from "@/module/common/hook/crossAppPrivyHooks";
import { jotaiStore } from "@module/atoms/store";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { RESET } from "jotai/utils";
import { useEffect } from "react";
import { isAddressEqual, zeroAddress } from "viem";

/**
 * Hook that synchronise the dynamic session
 */
export function useSyncEcdsaSession() {
    const { data: crossAppWallet, status } = useQuery(crossAppWalletQuery);
    const ecdsaSession = useAtomValue(ecdsaSessionAtom);

    useEffect(() => {
        if (!ecdsaSession) return;
        if (status !== "success") return;

        // If the addresses doesn't match, early reset
        if (
            !isAddressEqual(
                crossAppWallet ?? zeroAddress,
                ecdsaSession.publicKey
            )
        ) {
            jotaiStore.set(sessionAtom, RESET);
            jotaiStore.set(sdkSessionAtom, RESET);
            return;
        }

        // Otherwise, nothing to do
    }, [ecdsaSession, status, crossAppWallet]);
}
