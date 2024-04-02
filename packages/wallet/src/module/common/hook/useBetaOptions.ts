"use client";

import { useLocalStorage } from "@uidotdev/usehooks";
import { useCallback, useMemo } from "react";

type BetaOptionsState = {
    walletConnect: boolean;
};

/**
 * Hook to enable or disable certain features that are in beta
 */
export function useBetaOptions() {
    const [options, setOptions] = useLocalStorage<BetaOptionsState>(
        "betaOptions",
        {
            walletConnect: false,
        }
    );

    /**
     * Method used to toggle the wallet connect options
     */
    const toggleWalletConnect = useCallback(() => {
        setOptions((options) => ({
            ...options,
            walletConnect: !options.walletConnect,
        }));
    }, [setOptions]);

    return useMemo(
        () => ({
            options,
            toggleWalletConnect,
        }),
        [options, toggleWalletConnect]
    );
}
