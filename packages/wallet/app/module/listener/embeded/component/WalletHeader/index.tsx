import { sessionAtom } from "@/module/common/atoms/session";
import { useListenerUI } from "@/module/listener/providers/ListenerUiProvider";
import { LogoFrakWithName } from "@module/asset/icons/LogoFrakWithName";
import { jotaiStore } from "@module/atoms/store";
import styles from "../Wallet/index.module.css";

/**
 * Header of the wallet
 * @constructor
 */
export function ListenerWalletHeader() {
    const session = jotaiStore.get(sessionAtom);
    const { currentRequest } = useListenerUI();
    const logo =
        currentRequest?.type === "embeded"
            ? currentRequest?.params.metadata?.logo
            : undefined;

    return (
        <div className={styles.modalListenerWallet__header}>
            {session && (
                <LogoFrakWithName
                    width={63}
                    height={22}
                    className={styles.modalListenerWallet__logoFrak}
                />
            )}
            {logo && (
                <h1>
                    <img
                        src={logo}
                        className={styles.modalListenerWallet__logo}
                        alt=""
                    />
                </h1>
            )}
        </div>
    );
}
