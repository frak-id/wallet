import { sessionAtom } from "@/module/common/atoms/session";
import { useEmbededListenerUI } from "@/module/listener/providers/ListenerUiProvider";
import { LogoFrakWithName } from "@module/asset/icons/LogoFrakWithName";
import { jotaiStore } from "@module/atoms/store";
import styles from "../Wallet/index.module.css";

/**
 * Header of the wallet
 * @constructor
 */
export function ListenerWalletHeader() {
    const session = jotaiStore.get(sessionAtom);
    const {
        currentRequest: {
            params: { metadata },
        },
    } = useEmbededListenerUI();

    return (
        <div className={styles.modalListenerWallet__header}>
            {session && (
                <LogoFrakWithName
                    width={57}
                    height={16}
                    className={styles.modalListenerWallet__logoFrak}
                />
            )}
            {metadata?.logo && (
                <h1>
                    <img
                        src={metadata?.logo}
                        className={styles.modalListenerWallet__logo}
                        alt=""
                    />
                </h1>
            )}
        </div>
    );
}
