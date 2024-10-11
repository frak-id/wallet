import { LogoFrak } from "@module/asset/icons/LogoFrak";
import styles from "./SsoHeader.module.css";

export function SsoHeader() {
    return (
        <header className={styles.ssoHeader}>
            <LogoFrak sizes={14} />
            <h1 className={styles.ssoHeader__title}>
                Connexion avec Frak Wallet
            </h1>
        </header>
    );
}
