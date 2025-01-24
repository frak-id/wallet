import { emitLifecycleEvent } from "@/context/sdk/utils/lifecycleEvents";
import { sessionAtom } from "@/module/common/atoms/session";
import { Markdown } from "@/module/common/component/Markdown";
import { useListenerTranslation } from "@/module/listener/providers/ListenerUiProvider";
import type { DisplayEmbededWalletParamsType } from "@frak-labs/core-sdk";
import { jotaiStore } from "@module/atoms/store";
import { Overlay } from "@module/component/Overlay";
import { useCallback, useEffect, useMemo } from "react";
import styles from "./index.module.css";

type CommonProps = {
    params: DisplayEmbededWalletParamsType;
    appName: string;
};

export function ListenerWallet(props: CommonProps) {
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
                    <CurrentEmbeddedViewComponent {...props} />
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
function CurrentEmbeddedViewComponent(props: CommonProps) {
    const session = jotaiStore.get(sessionAtom);

    /**
     * Return the right component depending on the session
     */
    return useMemo(() => {
        if (session) {
            return <LoggedInComponent />;
        }

        return <LoggedOutComponent {...props} />;
    }, [session, props]);
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
function LoggedOutComponent({ params, appName }: CommonProps) {
    const { metadata, loggedOut } = params;
    const { t } = useListenerTranslation();

    return (
        <>
            {metadata?.logo && (
                <img
                    src={metadata.logo}
                    className={styles.modalListenerWallet__logo}
                    alt=""
                />
            )}
            <div className={styles.modalListenerWallet__text}>
                <Markdown
                    md={loggedOut?.metadata?.text}
                    defaultTxt={t("sdk.wallet.login.default.text", {
                        productName: appName,
                    })}
                />
            </div>
        </>
    );
}
