"use client";

import { useCallback, useMemo } from "react";
import useLocalStorageState from "use-local-storage-state";

type BetaOptionsState = {
    walletConnect: boolean;
};

/**
 * Hook to enable or disable certain features that are in beta
 */
export function useBetaOptions() {
    const [options, setOptions] = useLocalStorageState<BetaOptionsState>(
        "betaOptions",
        {
            defaultValue: {
                walletConnect: false,
            },
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
