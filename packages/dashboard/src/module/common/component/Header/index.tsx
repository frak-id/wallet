import { LogoFrak } from "@/assets/icons/LogoFrak";
import { NavigationTop } from "@/module/common/component/NavigationTop";
import Link from "next/link";
import styles from "./index.module.css";

export function Header() {
    return (
        <>
            <header className={styles.header}>
                <Link href={"/"} className={styles.header__logo}>
                    <LogoFrak />
                </Link>
                <NavigationTop />
            </header>
        </>
    );
}
