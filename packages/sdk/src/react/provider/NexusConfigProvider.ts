import { type PropsWithChildren, createContext, createElement } from "react";
import type { NexusWalletSdkConfig } from "../../core";

/**
 * The context that will keep the Nexus Wallet SDK configuration
 */
export const NexusConfigContext = createContext<
    NexusWalletSdkConfig | undefined
>(undefined);

/**
 * Props to instantiate the Nexus Wallet SDK configuration provider
 */
export type NexusConfigProviderProps = {
    config: Omit<NexusWalletSdkConfig, "domain"> & { domain?: string };
};

/**
 * Simple config provider for the Nexus Wallet SDK
 * @param parameters
 * @constructor
 */
export function NexusConfigProvider(
    parameters: PropsWithChildren<NexusConfigProviderProps>
) {
    const { children, config } = parameters;
    return createElement(
        NexusConfigContext.Provider,
        {
            value: {
                ...config,
                domain:
                    config.domain ??
                    (typeof window !== "undefined"
                        ? window?.location?.hostname
                        : undefined) ??
                    "not-found.com",
            },
        },
        children
    );
}
