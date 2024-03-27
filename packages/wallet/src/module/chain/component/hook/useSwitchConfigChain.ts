import { useCallback } from "react";
import { useConfig } from "wagmi";

/**
 * Hook used to perform a chain switch
 */
export function useSwitchConfigChain() {
    // The current wagmi config
    const wagmiConfig = useConfig();

    // Hook used to perform the chain switch
    return useCallback(
        (chainId: number) => {
            wagmiConfig.setState((x) => ({
                ...x,
                chainId,
            }));
        },
        [wagmiConfig]
    );
}
