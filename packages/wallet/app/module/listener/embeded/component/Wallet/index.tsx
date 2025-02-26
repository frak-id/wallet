import { sessionAtom } from "@/module/common/atoms/session";
import { ListenerWalletHeader } from "@/module/listener/embeded/component/WalletHeader";
import { LoggedInComponent } from "@/module/listener/embeded/component/WalletLoggedIn";
import { LoggedOutComponent } from "@/module/listener/embeded/component/WalletLoggedOut";
import { useEmbededListenerUI } from "@/module/listener/providers/ListenerUiProvider";
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
    } = useEmbededListenerUI();

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
            <ListenerWalletHeader />
            {session ? <LoggedInComponent /> : <LoggedOutComponent />}
        </div>
    );
}
