import { sessionAtom } from "@/module/common/atoms/session";
import { ListenerWalletHeader } from "@/module/listener/embeded/component/WalletHeader";
import { LoggedInComponent } from "@/module/listener/embeded/component/WalletLoggedIn";
import { LoggedOutComponent } from "@/module/listener/embeded/component/WalletLoggedOut";
import { useListenerUI } from "@/module/listener/providers/ListenerUiProvider";
import { jotaiStore } from "@module/atoms/store";
import { Overlay } from "@module/component/Overlay";
import { cx } from "class-variance-authority";
import styles from "./index.module.css";

export function ListenerWallet() {
    const { clearRequest } = useListenerUI();
    return (
        <>
            <div className={styles.modalListenerWallet}>
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
