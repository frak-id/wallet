import { Lottie } from "@/module/common/component/Lottie/index.client";
import { Link } from "@remix-run/react";
import { ClientOnly } from "remix-utils/client-only";
import logo from "/assets/logo-good-vibes.svg?url";
import styles from "./index.module.css";

export function Header() {
    return (
        <header className={styles.header}>
            <h1 className={styles.header__title}>
                <Link to={"/"} viewTransition className={styles.header__link}>
                    <img src={logo} alt="Good Vibes" />
                </Link>
            </h1>
            <ClientOnly>
                {() => <Lottie className={styles.header__lottie} />}
            </ClientOnly>
        </header>
    );
}
