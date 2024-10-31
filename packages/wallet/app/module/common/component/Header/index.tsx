import { LogoFrakWithName } from "@frak-labs/shared/module/asset/icons/LogoFrakWithName";
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
            </header>
        </>
    );
}
