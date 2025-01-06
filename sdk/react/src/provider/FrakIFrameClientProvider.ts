import {
    type FrakClient,
    type FrakWalletSdkConfig,
    baseIframeProps,
    createIFrameFrakClient,
} from "@frak-labs/core-sdk";
import {
    type CSSProperties,
    Fragment,
    type ReactNode,
    createContext,
    createElement,
    useState,
} from "react";
import { useFrakConfig } from "../hook";

/**
 * The context that will keep the Frak Wallet SDK client
 * @ignore
 */
export const FrakIFrameClientContext = createContext<FrakClient | undefined>(
    undefined
);

/**
 * Props to instantiate the Frak Wallet SDK configuration provider
 *
 * @group provider
 */
export type FrakIFrameClientProps = {
    config: FrakWalletSdkConfig;
};

/**
 * IFrame client provider for the Frak Wallet SDK
 * It will automatically create the frak wallet iFrame (required for the wallet to communicate with the SDK securely), and provide it in the context
 *
 * @group provider
 *
 * @remarks
 * This provider must be wrapped within a {@link FrakConfigProvider} to work properly
 *
 * @param args
 * @param args.style - Some custom styles to apply to the iFrame
 * @param args.children - Descedant components that will have access to the Frak Client
 */
export function FrakIFrameClientProvider({
    style,
    children,
}: {
    style?: CSSProperties;
    children?: ReactNode;
}) {
    const config = useFrakConfig();

    // Using a state for the client since using directly a client built inside the ref cause re-render loop
    const [client, setClient] = useState<FrakClient | undefined>(undefined);

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
                createIFrameFrakClient({
                    iframe,
                    config,
                })
            );
        },
    });

    // Create the component that will provide the client
    const providerComponent = createElement(
        FrakIFrameClientContext.Provider,
        { value: client },
        children
    );

    // Return both components
    return createElement(Fragment, null, iFrame, providerComponent);
}
