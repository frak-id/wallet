import { emitLifecycleEvent } from "@/context/sdk/utils/lifecycleEvents";
import { sessionAtom } from "@/module/common/atoms/session";
import type { DisplayEmbededWalletParamsType } from "@frak-labs/core-sdk";
import { jotaiStore } from "@module/atoms/store";
import { Overlay } from "@module/component/Overlay";
import { useCallback, useEffect, useMemo } from "react";
import styles from "./index.module.css";

export function ListenerWallet({
    params,
}: { params: DisplayEmbededWalletParamsType }) {
    /**
     * Display the iframe
     */
    useEffect(() => {
        emitLifecycleEvent({
            iframeLifecycle: "show",
        });
    }, []);

    /**
     * Method to close the modal
     */
    const onClose = useCallback(() => {
        emitLifecycleEvent({ iframeLifecycle: "hide" });
    }, []);

    return (
        <>
            <div className={styles.modalListenerWallet}>
                <div className={styles.modalListenerWallet__content}>
                    <CurrentEmbeddedViewComponent params={params} />
                </div>
            </div>
            <Overlay
                onOpenChange={(value) => {
                    !value && onClose();
                }}
            />
        </>
    );
}

/**
 * Return the right inner component depending on the current session
 * @constructor
 */
function CurrentEmbeddedViewComponent({
    params,
}: { params: DisplayEmbededWalletParamsType }) {
    const session = jotaiStore.get(sessionAtom);

    /**
     * Return the right component depending on the session
     */
    return useMemo(() => {
        if (session) {
            return <LoggedInComponent />;
        }

        return <LoggedOutComponent params={params} />;
    }, [session, params]);
}

/**
 * View for the logged in user
 * @constructor
 */
function LoggedInComponent() {
    return (
        <>
            <p className={styles.modalListenerWallet__text}>Logged in</p>
        </>
    );
}

/**
 * View for the logged out user
 * @constructor
 */
function LoggedOutComponent({
    params,
}: { params: DisplayEmbededWalletParamsType }) {
    const { metadata, loggedOut } = params;

    return (
        <>
            {metadata?.logo && (
                <img
                    src={metadata.logo}
                    className={styles.modalListenerWallet__logo}
                    alt=""
                />
            )}
            <p className={styles.modalListenerWallet__text}>
                {loggedOut?.metadata?.text ?? "Logged out"}
            </p>
        </>
    );
}
