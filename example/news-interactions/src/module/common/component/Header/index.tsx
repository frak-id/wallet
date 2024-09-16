import { Link } from "next-view-transitions";
import Image from "next/image";
import logo from "./assets/logo-good-vibes.svg";
import styles from "./index.module.css";

export function Header() {
    return (
        <header className={styles.header}>
            <h1 className={styles.header__title}>
                <Link href={"/"} className={styles.header__link}>
                    <Image priority={true} src={logo} alt="Good Vibes" />
                </Link>
            </h1>
            {/*todo: Disabled for now since it's fcking up deployment idk why*/}
            {/*<Lottie className={styles.header__lottie} />*/}
        </header>
    );
}
