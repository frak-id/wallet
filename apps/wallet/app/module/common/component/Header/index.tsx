import { LogoFrakWithName } from "@frak-labs/ui/icons/LogoFrakWithName";
import { Notifications } from "@frak-labs/ui/icons/Notifications";
import { selectSession, sessionStore } from "@frak-labs/wallet-shared";
import { Link } from "@tanstack/react-router";
import { useHydrated } from "remix-utils/use-hydrated";
import styles from "./index.module.css";

export function Header() {
    const isHydrated = useHydrated();
    const session = sessionStore(selectSession);

    return (
        <header className={styles.header}>
            <div className={styles.header__container}>
                <h1>
                    <Link
                        to={"/wallet"}
                        className={styles.header__logo}
                        viewTransition
                    >
                        <LogoFrakWithName />
                    </Link>
                </h1>
                {isHydrated && session && (
                    <Link
                        to={"/notifications"}
                        className={styles.header__notification}
                        viewTransition
                    >
                        <Notifications />
                    </Link>
                )}
            </div>
        </header>
    );
}
