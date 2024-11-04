import { LogoFrakWithName } from "@frak-labs/shared/module/asset/icons/LogoFrakWithName";
import { Notifications } from "@module/asset/icons/Notifications";
import { Link } from "@remix-run/react";
import styles from "./index.module.css";

export function Header() {
    return (
        <>
            <header className={styles.header}>
                <h1>
                    <Link
                        to={"/wallet"}
                        className={styles.header__logo}
                        viewTransition
                    >
                        <LogoFrakWithName />
                    </Link>
                </h1>
                <Link
                    to={"/notifications"}
                    className={styles.header__notification}
                    viewTransition
                >
                    <Notifications />
                </Link>
            </header>
        </>
    );
}
