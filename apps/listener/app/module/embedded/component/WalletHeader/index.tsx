import { LogoFrakWithName } from "@frak-labs/wallet-shared/common";
import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import { clsx as cx } from "clsx";
import { useState } from "react";
import { prefixWalletCss } from "@/module/common/utils/prefixWalletCss";
import { useEmbeddedListenerUI } from "@/ui/ListenerUiProvider";
import * as styles from "../Wallet/index.css";

/**
 * Header of the wallet
 * @constructor
 */
export function ListenerWalletHeader() {
    const session = sessionStore.getState().session;
    const {
        currentRequest: { logoUrl },
    } = useEmbeddedListenerUI();
    const [logoFailed, setLogoFailed] = useState(false);

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
            {logoUrl && !logoFailed && (
                <h1>
                    <img
                        src={logoUrl}
                        className={cx(
                            styles.modalListenerWallet__logo,
                            prefixWalletCss("modalListenerWallet__logo")
                        )}
                        alt=""
                        onError={() => setLogoFailed(true)}
                    />
                </h1>
            )}
        </div>
    );
}
