import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { LogoFrakWithName } from "@frak-labs/ui/icons/LogoFrakWithName";
import { prefixWalletCss } from "@frak-labs/ui/utils/prefixWalletCss";
import { cx } from "class-variance-authority";
import { sessionAtom } from "@/module/common/atoms/session";
import { useEmbeddedListenerUI } from "@/module/listener/providers/ListenerUiProvider";
import styles from "../Wallet/index.module.css";

/**
 * Header of the wallet
 * @constructor
 */
export function ListenerWalletHeader() {
    const session = jotaiStore.get(sessionAtom);
    const {
        currentRequest: { logoUrl },
    } = useEmbeddedListenerUI();

    return (
        <div
            className={cx(
                styles.modalListenerWallet__header,
                prefixWalletCss("modalListenerWallet__header")
            )}
        >
            {session && (
                <LogoFrakWithName
                    width={57}
                    height={16}
                    className={cx(
                        styles.modalListenerWallet__logoFrak,
                        prefixWalletCss("logoFrak")
                    )}
                />
            )}
            {logoUrl && (
                <h1>
                    <img
                        src={logoUrl}
                        className={cx(
                            styles.modalListenerWallet__logo,
                            prefixWalletCss("modalListenerWallet__logo")
                        )}
                        alt=""
                    />
                </h1>
            )}
        </div>
    );
}
