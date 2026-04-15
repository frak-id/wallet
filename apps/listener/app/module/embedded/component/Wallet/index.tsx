import { Overlay } from "@frak-labs/design-system/components/Overlay";
import { InAppBrowserToast, sessionStore } from "@frak-labs/wallet-shared";
import { cva, cx } from "class-variance-authority";
import { Toaster } from "sonner";
import { prefixWalletCss } from "@/module/common/utils/prefixWalletCss";
import { ListenerWalletHeader } from "@/module/embedded/component/WalletHeader";
import { LoggedInComponent } from "@/module/embedded/component/WalletLoggedIn";
import { LoggedOutComponent } from "@/module/embedded/component/WalletLoggedOut";
import { useGetMergeToken } from "@/module/hooks/useGetMergeToken";
import { useEmbeddedListenerUI } from "@/module/providers/ListenerUiProvider";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
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
            <Overlay onClick={() => clearRequest()} />
        </>
    );
}

/**
 * Return the right inner component depending on the current session
 * @constructor
 */
function CurrentEmbeddedViewComponent() {
    const session = sessionStore.getState().session;
    const getMergeToken = useGetMergeToken();
    const parentUrl = resolvingContextStore((s) => s.context?.sourceUrl);
    return (
        <div
            className={cx(
                styles.modalListenerWallet__inner,
                session && styles["modalListenerWallet__inner--loggedIn"],
                prefixWalletCss("modalListenerWallet__inner")
            )}
        >
            <Toaster position="top-center" />
            <InAppBrowserToast
                getMergeToken={getMergeToken}
                parentUrl={parentUrl}
            />
            <ToastLoading />
            <ListenerWalletHeader />
            {session ? <LoggedInComponent /> : <LoggedOutComponent />}
        </div>
    );
}
