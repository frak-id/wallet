import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { Overlay } from "@frak-labs/ui/component/Overlay";
import { prefixWalletCss } from "@frak-labs/ui/utils/prefixWalletCss";
import { cva, cx } from "class-variance-authority";
import { Toaster } from "sonner";
import { sessionAtom } from "@/module/common/atoms/session";
import { InAppBrowserToast } from "@/module/common/component/InAppBrowserToast";
import { ListenerWalletHeader } from "@/module/listener/embedded/component/WalletHeader";
import { LoggedInComponent } from "@/module/listener/embedded/component/WalletLoggedIn";
import { LoggedOutComponent } from "@/module/listener/embedded/component/WalletLoggedOut";
import { useEmbeddedListenerUI } from "@/module/listener/providers/ListenerUiProvider";
import { ToastLoading } from "../../../component/ToastLoading";
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
            <div
                className={cx(
                    walletStyles({ position: metadata?.position }),
                    prefixWalletCss("modalListenerWallet")
                )}
            >
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
                session && styles["modalListenerWallet__inner--loggedIn"],
                prefixWalletCss("modalListenerWallet__inner")
            )}
        >
            <Toaster position="top-center" />
            <InAppBrowserToast />
            <ToastLoading />
            <ListenerWalletHeader />
            {session ? <LoggedInComponent /> : <LoggedOutComponent />}
        </div>
    );
}
