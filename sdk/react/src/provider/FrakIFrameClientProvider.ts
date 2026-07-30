import {
    baseIframeProps,
    buildListenerUrl,
    createIFrameFrakClient,
    type FrakClient,
    type FrakWalletSdkConfig,
    getClientIdAsync,
} from "@frak-labs/core-sdk";
import { useQuery } from "@tanstack/react-query";
import {
    type CSSProperties,
    createContext,
    createElement,
    Fragment,
    type ReactNode,
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

    // The iframe element itself, captured from the ref so the client query
    // below can run once it exists.
    const [iframe, setIframe] = useState<HTMLIFrameElement | null>(null);

    // Seed the listener URL with the derived anonymous id. This provider used
    // to omit `clientId` entirely, so the listener fell back to its own store.
    const { data: iframeSrc } = useQuery({
        queryKey: ["frak", "listener-url", config.walletUrl],
        queryFn: async () => {
            const clientId = await getClientIdAsync().catch(() => undefined);
            return buildListenerUrl({
                walletUrl: config.walletUrl,
                clientId,
                preload: config.preload ?? ["sharing"],
            });
        },
        staleTime: Number.POSITIVE_INFINITY,
    });

    const { data: client } = useQuery({
        queryKey: ["frak", "iframe-client", iframeSrc],
        queryFn: () =>
            createIFrameFrakClient({
                iframe: iframe as HTMLIFrameElement,
                config,
            }),
        enabled: !!iframe,
        staleTime: Number.POSITIVE_INFINITY,
        // A persister would serialise the client, dropping `request` and
        // leaving a truthy, dead object that the infinite staleTime never
        // refetches.
        meta: { storable: false },
    });

    // Create the iframe that will be used to communicate with the wallet.
    // Rendered only once the src is known, so it never loads twice.
    const iFrame = iframeSrc
        ? createElement("iframe", {
              ...baseIframeProps,
              src: iframeSrc,
              style: style ?? baseIframeProps.style,
              ref: setIframe,
          })
        : null;

    // Create the component that will provide the client
    const providerComponent = createElement(
        FrakIFrameClientContext.Provider,
        { value: client },
        children
    );

    // Return both components
    return createElement(Fragment, null, iFrame, providerComponent);
}
