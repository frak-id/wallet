import { Lottie } from "@/module/common/component/Lottie";
import logo from "@/public/assets/logo-good-vibes.svg";
import { Link } from "next-view-transitions";
import Image from "next/image";
import styles from "./index.module.css";

export function Header() {
    return (
        <header className={styles.header}>
            <h1 className={styles.header__title}>
                <Link href={"/"} className={styles.header__link}>
                    <Image priority={true} src={logo} alt="Good Vibes" />
                </Link>
            </h1>
            <Lottie className={styles.header__lottie} />
        </header>
    );
}
