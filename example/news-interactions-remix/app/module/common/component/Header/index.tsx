import { Lottie } from "@/module/common/component/Lottie/index.client";
import logo from "@/public/assets/logo-good-vibes.svg";
import { Link } from "@remix-run/react";
import { ClientOnly } from "remix-utils/client-only";
import styles from "./index.module.css";

export function Header() {
    return (
        <header className={styles.header}>
            <h1 className={styles.header__title}>
                <Link to={"/"} className={styles.header__link}>
                    <img src={logo} alt="Good Vibes" />
                </Link>
            </h1>
            <ClientOnly fallback={<p>Loading...</p>}>
                {() => <Lottie className={styles.header__lottie} />}
            </ClientOnly>
        </header>
    );
}
