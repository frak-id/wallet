"use client";

import { createIFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { useArticleUnlockStatusListener } from "@/module/listener/hooks/useArticleUnlockStatusListener";
import { useDashboardActionListener } from "@/module/listener/hooks/useDashboardActionListener";
import { useGetArticleUnlockOptionsListener } from "@/module/listener/hooks/useGetArticleUnlockOptionsListener";
import { useSendTransactionListener } from "@/module/listener/hooks/useSendTransactionListener";
import { useSetUserReferredListener } from "@/module/listener/hooks/useSetUserReferredListener";
import { useSiweAuthenticateListener } from "@/module/listener/hooks/useSiweAuthenticateListener";
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
    const { onWalletListenRequest } = useWalletStatusListener();

    // Hook a website want to fetch the unlock options for an article
    const { onGetArticleUnlockOptions } = useGetArticleUnlockOptionsListener();

    // Hook to listen for the gating unlock status of an article
    const { onArticleUnlockStatusListenerRequest } =
        useArticleUnlockStatusListener();

    // Hook used when a user referred is requested
    const { onUserReferredListenRequest } = useSetUserReferredListener();

    // Hook used when a dashboard action is requested
    const {
        onDashboardActionListenRequest,
        isDialogOpen,
        doSomething,
        doNothing,
    } = useDashboardActionListener();

    // Hook used when a dashboard action is requested
    const { onSendTransactionRequest, component: sendTxComponent } =
        useSendTransactionListener();

    // Hook used when a dashboard action is requested
    const { onSiweAuthenticateRequest, component: siweAuthenticateComponent } =
        useSiweAuthenticateListener();

    // Create the resolver
    useEffect(() => {
        const newResolver = createIFrameRequestResolver({
            /**
             * Listen request on an article unlock status
             */
            frak_listenToArticleUnlockStatus:
                onArticleUnlockStatusListenerRequest,

            /**
             * Listen request on the wallet status
             */
            frak_listenToWalletStatus: onWalletListenRequest,

            /**
             * Get the unlock options for an article
             * @param request
             * @param emitter
             */
            frak_getArticleUnlockOptions: onGetArticleUnlockOptions,

            /**
             * Listen request on the user referred
             */
            frak_listenToSetUserReferred: onUserReferredListenRequest,

            /**
             * Listen request for the dashboard action
             */
            frak_listenToDashboardAction: onDashboardActionListenRequest,

            /**
             * Listen request for the dashboard action
             */
            frak_sendTransaction: onSendTransactionRequest,

            /**
             * Listen request for the authentication request
             */
            frak_siweAuthenticate: onSiweAuthenticateRequest,
        });

        // Set our new resolver
        setResolver(newResolver);

        // On cleanup, destroy the resolver
        return () => {
            newResolver.destroy();
        };
    }, [
        onWalletListenRequest,
        onGetArticleUnlockOptions,
        onArticleUnlockStatusListenerRequest,
        onUserReferredListenRequest,
        onDashboardActionListenRequest,
        onSendTransactionRequest,
        onSiweAuthenticateRequest,
    ]);

    /**
     * Once all the required state are set, we can start handling the request
     */
    useEffect(() => {
        if (
            resolver &&
            typeof onWalletListenRequest === "function" &&
            typeof onGetArticleUnlockOptions === "function" &&
            typeof onArticleUnlockStatusListenerRequest === "function"
        ) {
            resolver.setReadyToHandleRequest();
        }
    }, [
        resolver,
        onWalletListenRequest,
        onGetArticleUnlockOptions,
        onArticleUnlockStatusListenerRequest,
    ]);

    useEffect(() => {
        const rootElement = document.querySelector(":root") as HTMLElement;
        if (rootElement) {
            rootElement.dataset.listener = "true";
        }

        return () => {
            rootElement.dataset.listener = "false";
        };
    }, []);

    return (
        <>
            {/*
                Send tx component if needed
                todo: Should we got with a more generic approach? Like alert dialog component, with hook returning inner components?
            */}
            {sendTxComponent}
            {siweAuthenticateComponent}
            {/*Alert dialog for the dashboard action*/}
            <AlertDialog
                open={isDialogOpen}
                text={
                    <>
                        <p>Are you sure you want to do something?</p>
                        <ButtonRipple onClick={() => doSomething()}>
                            Yes
                        </ButtonRipple>
                        <ButtonRipple onClick={() => doNothing()}>
                            No
                        </ButtonRipple>
                    </>
                }
            />
        </>
    );
}
