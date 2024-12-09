import { Lottie } from "@/module/common/component/Lottie/index.client";
import { Link } from "react-router";
import { useHydrated } from "remix-utils/use-hydrated";
import logo from "/assets/logo-good-vibes.svg?url";
import styles from "./index.module.css";

export function Header() {
    const isHydrated = useHydrated();

    return (
        <header className={styles.header}>
            <h1 className={styles.header__title}>
                <Link to={"/"} viewTransition className={styles.header__link}>
                    <img src={logo} alt="Good Vibes" width={221} height={31} />
                </Link>
            </h1>
            {isHydrated && <Lottie className={styles.header__lottie} />}
        </header>
    );
}
