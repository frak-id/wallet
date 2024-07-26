import {
    type CSSProperties,
    Fragment,
    type ReactNode,
    createContext,
    createElement,
    useState,
} from "react";
import {
    type NexusClient,
    type NexusWalletSdkConfig,
    createIFrameNexusClient,
} from "../../core";
import { baseIframeProps } from "../../core/utils/iframeHelper";
import { useNexusConfig } from "../hook";

/**
 * The context that will keep the Nexus Wallet SDK client
 */
export const NexusIFrameClientContext = createContext<NexusClient | undefined>(
    undefined
);

/**
 * Props to instantiate the Nexus Wallet SDK configuration provider
 */
export type NexusIFrameClientProps = {
    config: NexusWalletSdkConfig;
};

/**
 * IFrame client provider for the Nexus Wallet SDK
 *  - Automatically set the config provider
 * @param parameters
 * @constructor
 */
export function NexusIFrameClientProvider({
    style,
    children,
}: {
    style?: CSSProperties;
    children?: ReactNode;
}) {
    const config = useNexusConfig();

    // Using a state for the client since using directly a client built inside the ref cause re-render loop
    const [client, setClient] = useState<NexusClient | undefined>(undefined);

    // Create the iframe that will be used to communicate with the wallet
    const iFrame = createElement("iframe", {
        ...baseIframeProps,
        src: `${config.walletUrl}/listener`,
        style: style ?? baseIframeProps.style,
        ref: (iframe: HTMLIFrameElement) => {
            if (!iframe || client) {
                return;
            }
            setClient(
                createIFrameNexusClient({
                    iframe,
                    config,
                })
            );
        },
    });

    // Create the component that will provide the client
    const providerComponent = createElement(
        NexusIFrameClientContext.Provider,
        { value: client },
        children
    );

    // Return both components
    return createElement(Fragment, null, iFrame, providerComponent);
}
