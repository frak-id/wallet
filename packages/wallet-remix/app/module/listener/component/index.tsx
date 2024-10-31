import { createIFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { ListenerModal } from "@/module/listener/component/Modal";
import { useDisplayModalListener } from "@/module/listener/hooks/useDisplayModalListener";
import { useOnOpenSso } from "@/module/listener/hooks/useOnOpenSso";
import { useSendInteractionListener } from "@/module/listener/hooks/useSendInteractionListener";
import { useWalletStatusListener } from "@/module/listener/hooks/useWalletStatusListener";
import { useEffect, useState } from "react";

/**
 * Global Listener UI that cna only be set via an iFrame
 *  - It's goal is to answer every request from the iFrame windows parent
 * @constructor
 */
export function ListenerUI() {
    const [resolver, setResolver] = useState<
        ReturnType<typeof createIFrameRequestResolver> | undefined
    >(undefined);

    // Hook used when a wallet status is requested
    const onWalletListenRequest = useWalletStatusListener();

    // Hook used when a dashboard action is requested
    const onInteractionRequest = useSendInteractionListener();

    // Hook when a modal display is asked
    const onDisplayModalRequest = useDisplayModalListener();

    // Hook when a modal display is asked
    const onOpenSso = useOnOpenSso();

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
            frak_displayModal: onDisplayModalRequest,

            /**
             * Listen request for the open sso request
             */
            frak_sso: onOpenSso,
        });

        // Set our new resolver
        setResolver(newResolver);

        // On cleanup, destroy the resolver
        return () => {
            newResolver.destroy();
        };
    }, [
        onWalletListenRequest,
        onInteractionRequest,
        onDisplayModalRequest,
        onOpenSso,
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

    return <ListenerModal />;
}
