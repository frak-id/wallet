import { sessionAtom } from "@/module/common/atoms/session";
import { InAppBrowserToast } from "@/module/common/component/InAppBrowserToast";
import { ListenerWalletHeader } from "@/module/listener/embedded/component/WalletHeader";
import { LoggedInComponent } from "@/module/listener/embedded/component/WalletLoggedIn";
import { LoggedOutComponent } from "@/module/listener/embedded/component/WalletLoggedOut";
import { useEmbeddedListenerUI } from "@/module/listener/providers/ListenerUiProvider";
import { jotaiStore } from "@shared/module/atoms/store";
import { Overlay } from "@shared/module/component/Overlay";
import { cva, cx } from "class-variance-authority";
import styles from "./index.module.css";

const walletStyles = cva(styles.modalListenerWallet, {
    variants: {
        position: {
            left: styles.modalListenerWallet__left,
            right: styles.modalListenerWallet__right,
        },
    },
    defaultVariants: {
        position: "right",
    },
});

export function ListenerWallet() {
    const {
        clearRequest,
        currentRequest: {
            params: { metadata },
        },
    } = useEmbeddedListenerUI();

    return (
        <>
            <div className={walletStyles({ position: metadata?.position })}>
                <CurrentEmbeddedViewComponent />
            </div>
            <Overlay
                onOpenChange={(value) => {
                    !value && clearRequest();
                }}
            />
        </>
    );
}

/**
 * Return the right inner component depending on the current session
 * @constructor
 */
function CurrentEmbeddedViewComponent() {
    const session = jotaiStore.get(sessionAtom);

    return (
        <div
            className={cx(
                styles.modalListenerWallet__inner,
                session && styles["modalListenerWallet__inner--loggedIn"]
            )}
        >
            <InAppBrowserToast />
            <ListenerWalletHeader />
            {session ? <LoggedInComponent /> : <LoggedOutComponent />}
        </div>
    );
}
