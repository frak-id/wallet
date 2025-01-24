import { createIFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { ListenerUiRenderer } from "@/module/listener/component/ListerUiRenderer";
import { useDisplayModalListener } from "@/module/listener/hooks/useDisplayModalListener";
import { useListenerDataPreload } from "@/module/listener/hooks/useListenerDataPreload";
import { useOnGetProductInformation } from "@/module/listener/hooks/useOnGetProductInformation";
import { useOnOpenSso } from "@/module/listener/hooks/useOnOpenSso";
import { useSendInteractionListener } from "@/module/listener/hooks/useSendInteractionListener";
import { useWalletStatusListener } from "@/module/listener/hooks/useWalletStatusListener";
import {
    ListenerUiProvider,
    useListenerUI,
} from "@/module/listener/providers/ListenerUiProvider";
import { useEffect, useState } from "react";

/**
 * Top level listener, wrapped with the Listener Ui context
 */
export default function Listener() {
    return (
        <ListenerUiProvider>
            <ListenerContent />
        </ListenerUiProvider>
    );
}

/**
 * Global Listener UI that can only be set via an iFrame
 *  - It's goal is to answer every request from the iFrame windows parent
 * @constructor
 */
function ListenerContent() {
    const [resolver, setResolver] = useState<
        ReturnType<typeof createIFrameRequestResolver> | undefined
    >(undefined);

    // Hook used to set the requested listener UI
    const { setRequest } = useListenerUI();

    // Hook used when a wallet status is requested
    const onWalletListenRequest = useWalletStatusListener();

    // Hook used when a dashboard action is requested
    const onInteractionRequest = useSendInteractionListener();

    // Hook when a modal display is asked
    const onDisplayModalRequest = useDisplayModalListener();

    // Hook when a modal display is asked
    const onOpenSso = useOnOpenSso();

    // Hook when the product information are asked
    const onGetProductInformation = useOnGetProductInformation();

    // Create the resolver
    useEffect(() => {
        const newResolver = createIFrameRequestResolver({
            /**
             * Listen request on the wallet status
             */
            frak_listenToWalletStatus: onWalletListenRequest,

            /**
             * Listen request for the send interaction request
             */
            frak_sendInteraction: onInteractionRequest,

            /**
             * Listen request for the modal display request
             */
            frak_displayModal: (request, context, emitter) => {
                return onDisplayModalRequest(request, context, emitter);
            },

            /**
             * Listen request for the open sso request
             */
            frak_sso: onOpenSso,

            /**
             * Listen request for the product information
             */
            frak_getProductInformation: onGetProductInformation,

            /**
             * When the display of the embeded wallet is requested
             */
            frak_displayEmbededWallet: async (request) => {
                setRequest({
                    type: "embeded",
                    params: request.params[0],
                    appName: request.params[1],
                    i18n: {
                        lang: request.params[0].metadata?.lang,
                    },
                });
            },
        });

        // Set our new resolver
        setResolver(newResolver);

        // On cleanup, destroy the resolver
        return () => {
            newResolver.destroy();
        };
    }, [
        setRequest,
        onWalletListenRequest,
        onInteractionRequest,
        onDisplayModalRequest,
        onOpenSso,
        onGetProductInformation,
    ]);

    /**
     * Once all the required state are set, we can start handling the request
     */
    useEffect(() => {
        if (resolver && typeof onWalletListenRequest === "function") {
            resolver.setReadyToHandleRequest();
        }
    }, [resolver, onWalletListenRequest]);

    /**
     * Add a data attribute to the root element to style the layout
     */
    useEffect(() => {
        const rootElement = document.querySelector(":root") as HTMLElement;
        if (rootElement) {
            rootElement.dataset.listener = "true";
        }

        return () => {
            rootElement.dataset.listener = "false";
        };
    }, []);

    /**
     * Preload a few data
     */
    useListenerDataPreload();

    return <ListenerUiRenderer />;
}
