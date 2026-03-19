import { ButtonRefresh } from "@frak-labs/ui/component/ButtonRefresh";
import { LogoFrak } from "@frak-labs/ui/icons/LogoFrak";
import { Link } from "@tanstack/react-router";
import { User } from "lucide-react";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import styles from "./index.module.css";

export function Header() {
    const isDemoMode = useIsDemoMode();

    return (
        <div>
            <header className={styles.header}>
                <Link to="/dashboard" className={styles.header__logo}>
                    <LogoFrak />
                </Link>
                <div className={styles.navigationTop__container}>
                    {isDemoMode && (
                        <Link
                            to="/settings"
                            className={styles.demoModeBadge}
                            title="Demo mode is active. Click to manage settings."
                        >
                            demo
                        </Link>
                    )}
                    <ButtonRefresh />
                    <Link to="/settings" className={styles.navigationProfile}>
                        <span>
                            <span className={styles.navigationProfile__avatar}>
                                <User />
                            </span>
                        </span>
                        <span className={styles.navigationProfile__infos}>
                            My account
                        </span>
                    </Link>
                </div>
            </header>
        </div>
    );
}
