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
    useEffect,
    useRef,
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
    // `useFrakConfig` returns a new object on every render: as an effect
    // dependency it would rebuild the client each time.
    const [initialConfig] = useState(config);

    // The iframe element itself, captured from the ref so the client effect
    // below can run once it exists.
    const [iframe, setIframe] = useState<HTMLIFrameElement | null>(null);
    const [client, setClient] = useState<FrakClient>();
    const live = useRef<{
        iframe: HTMLIFrameElement;
        created: Promise<FrakClient | undefined>;
    }>(undefined);

    // Seed the listener URL with the derived anonymous id; without it the
    // listener falls back to its own store.
    const { data: iframeSrc } = useQuery({
        queryKey: ["frak", "listener-url", config.env],
        queryFn: async () => {
            const clientId = await getClientIdAsync().catch(() => undefined);
            return buildListenerUrl({
                clientId,
                preload: config.preload ?? ["sharing"],
            });
        },
        staleTime: Number.POSITIVE_INFINITY,
    });

    useEffect(() => {
        if (!iframe) return;
        if (live.current?.iframe !== iframe) {
            live.current = {
                iframe,
                created: createIFrameFrakClient({
                    iframe,
                    config: initialConfig,
                }).catch((error: unknown) => {
                    console.error("[Frak] Failed to create the client", error);
                    return undefined;
                }),
            };
        }
        const { created } = live.current;
        let released = false;
        void created.then((next) => {
            if (!released) setClient(next);
        });
        return () => {
            released = true;
            // `<Activity>` hides with the iframe still in the DOM: keep its
            // client so in-flight requests still settle.
            if (iframe.isConnected) return;
            live.current = undefined;
            setClient(undefined);
            // `detachOnly`: React owns the iframe element.
            void created.then((stale) => stale?.destroy({ detachOnly: true }));
        };
    }, [iframe, initialConfig]);

    // Create the iframe that will be used to communicate with the wallet.
    // Rendered only once the src is known, so it never loads twice. Keyed on
    // the src so a new src gets a new element, and with it a new client.
    const iFrame = iframeSrc
        ? createElement("iframe", {
              ...baseIframeProps,
              key: iframeSrc,
              src: iframeSrc,
              style: style ?? baseIframeProps.style,
              ref: setIframe,
          })
        : null;

    const providerComponent = createElement(
        FrakIFrameClientContext.Provider,
        { value: client },
        children
    );

    return createElement(Fragment, null, iFrame, providerComponent);
}
