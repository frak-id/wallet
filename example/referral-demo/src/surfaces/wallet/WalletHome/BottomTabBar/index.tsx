import {
    ExplorerIcon,
    ProfileIcon,
    WalletIcon,
} from "@frak-labs/design-system/icons";
import { useT } from "@/i18n";
import { walletMessages } from "../../messages";
import * as styles from "./bottomTabBar.css";

const tabs = [
    { key: "wallet", label: "wallet.tab.wallet", Icon: WalletIcon },
    { key: "explorer", label: "wallet.tab.explorer", Icon: ExplorerIcon },
    { key: "profile", label: "wallet.tab.profile", Icon: ProfileIcon },
] as const;

/** The wallet's frosted tab bar, parked on the wallet tab. */
export function BottomTabBar() {
    const t = useT(walletMessages);
    return (
        <div className={styles.wrapper}>
            <span className={styles.progressiveBlur} aria-hidden="true" />
            <nav className={styles.pill}>
                {tabs.map(({ key, label, Icon }) => (
                    <span
                        key={key}
                        className={styles.tab}
                        aria-current={key === "wallet" ? "page" : undefined}
                    >
                        <span className={styles.tabIcon}>
                            <Icon />
                        </span>
                        <span className={styles.tabLabel}>{t(label)}</span>
                    </span>
                ))}
                <span className={styles.glider} aria-hidden="true" />
            </nav>
        </div>
    );
}
