import { sessionAtom } from "@/module/common/atoms/session";
import { useEmbeddedListenerUI } from "@/module/listener/providers/ListenerUiProvider";
import { LogoFrakWithName } from "@shared/module/asset/icons/LogoFrakWithName";
import { jotaiStore } from "@shared/module/atoms/store";
import { prefixWalletCss } from "@shared/module/utils/prefixWalletCss";
import { cx } from "class-variance-authority";
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
        <div className={styles.modalListenerWallet__header}>
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
                        className={styles.modalListenerWallet__logo}
                        alt=""
                    />
                </h1>
            )}
        </div>
    );
}
