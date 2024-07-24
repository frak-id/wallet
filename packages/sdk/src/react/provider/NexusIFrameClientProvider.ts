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
 * Default style for the iframe
 */
const defaultIframeStyle: CSSProperties = {
    width: "0",
    height: "0",
    border: "0",
    position: "absolute",
    zIndex: 1000,
    top: "-1000px",
    left: "-1000px",
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
        id: "nexus-wallet",
        name: "nexus-wallet",
        src: `${config.walletUrl}/listener`,
        style: style ?? defaultIframeStyle,
        allow: "publickey-credentials-get *; clipboard-write",
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
