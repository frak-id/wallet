import { type FrakWalletSdkConfig, setEnvironment } from "@frak-labs/core-sdk";
import {
    createContext,
    createElement,
    type PropsWithChildren,
    useState,
} from "react";

/**
 * The context that will keep the Frak Wallet SDK configuration
 * @ignore
 */
export const FrakConfigContext = createContext<FrakWalletSdkConfig | undefined>(
    undefined
);

/**
 * Props to instantiate the Frak Wallet SDK configuration provider
 *
 * @group provider
 */
export type FrakConfigProviderProps = {
    /**
     * The wanted Frak configuration
     * @see {@link @frak-labs/core-sdk!index.FrakWalletSdkConfig | FrakWalletSdkConfig}
     */
    config: FrakWalletSdkConfig;
};

/**
 * Simple config provider for the Frak Wallet SDK
 *
 * Should be wrapped within a {@link @tanstack/react-query!QueryClientProvider | `QueryClientProvider`}
 *
 * @group provider
 *
 * @param parameters
 */
export function FrakConfigProvider(
    parameters: PropsWithChildren<FrakConfigProviderProps>
) {
    const { children, config } = parameters;

    // Publish the wallet/backend origins as early as the config exists — core
    // actions read them from the singleton, and some (`trackPurchaseStatus`)
    // can fire without ever touching the iframe client. It cannot be an
    // effect: children's own effects and queries run first and would read the
    // wrong stage. A state initializer is the next-earliest hook, and unlike a
    // bare call in the render body it runs once per provider rather than on
    // every render.
    useState(() => setEnvironment(config.env));

    return createElement(
        FrakConfigContext.Provider,
        {
            value: {
                ...config,
                domain:
                    config.domain ??
                    (typeof window !== "undefined"
                        ? window?.location?.host
                        : undefined) ??
                    "not-found",
            },
        },
        children
    );
}
