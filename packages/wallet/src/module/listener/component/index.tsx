"use client";

import { createIFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { useArticleUnlockStatusListener } from "@/module/listener/hooks/useArticleUnlockStatusListener";
import { useDashboardActionListener } from "@/module/listener/hooks/useDashboardActionListener";
import { useGetArticleUnlockOptionsListener } from "@/module/listener/hooks/useGetArticleUnlockOptionsListener";
import { useSetUserReferredListener } from "@/module/listener/hooks/useSetUserReferredListener";
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

    // Hook used when a wallet status is requested
    const { onGetArticleUnlockOptions } = useGetArticleUnlockOptionsListener();

    // Hook used when a wallet status is requested
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
        <AlertDialog
            open={isDialogOpen}
            text={
                <>
                    <p>Are you sure you want to do something?</p>
                    <ButtonRipple onClick={() => doSomething()}>
                        Yes
                    </ButtonRipple>
                    <ButtonRipple onClick={() => doNothing()}>No</ButtonRipple>
                </>
            }
        />
    );
}
