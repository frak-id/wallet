import { useStore } from "zustand";
import { Overlay } from "@frak-labs/design-system/components/Overlay";
import { InAppBrowserToast } from "@frak-labs/wallet-shared/common";
import { usePersistentPairingClient } from "@frak-labs/wallet-shared/pairing/usePersistentPairingClient";
import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import clsx from "clsx";
import { Toaster } from "sonner";
import { prefixWalletCss } from "@/module/common/utils/prefixWalletCss";
import { ListenerWalletHeader } from "@/module/embedded/component/WalletHeader";
import { LoggedInComponent } from "@/module/embedded/component/WalletLoggedIn";
import { LoggedOutComponent } from "@/module/embedded/component/WalletLoggedOut";
import { useGetMergeToken } from "@/module/hooks/useGetMergeToken";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import { BlockchainProvider } from "@/ui/BlockchainProvider";
import { useEmbeddedListenerUI } from "@/ui/ListenerUiProvider";
import { ToastLoading } from "../../../component/ToastLoading";
import * as styles from "./index.css";

// Re-export the lazy handler body so it lands in the Wallet default chunk
// instead of its own .impl shim chunk. See useDisplayEmbeddedWallet.ts.
export { handleDisplayEmbeddedWallet } from "@/module/hooks/useDisplayEmbeddedWallet.impl";

export function ListenerWallet() {
    return (
        <BlockchainProvider>
            <ListenerWalletInner />
        </BlockchainProvider>
    );
}

function ListenerWalletInner() {
    const {
        clearRequest,
        currentRequest: {
            params: { metadata },
        },
    } = useEmbeddedListenerUI();
    // Pairing reconnect lives inside the lazy embedded-wallet tree so the
    // WebSocket only opens when a partner site actually displays the wallet
    // — keeping idle iframes off the backend pairing socket.
    usePersistentPairingClient();

    return (
        <>
            <div
                className={clsx(
                    styles.modalListenerWallet,
                    styles.position[metadata?.position ?? "right"],
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
    const parentUrl = useStore(resolvingContextStore, (s) => s.context?.sourceUrl);
    return (
        <div
            className={clsx(
                styles.modalListenerWallet__inner,
                session && styles.modalListenerWallet__innerLoggedIn,
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
