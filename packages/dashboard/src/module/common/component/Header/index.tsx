import { NavigationTop } from "@/module/common/component/NavigationTop";
import { LogoFrak } from "@frak-labs/shared/module/asset/icons/LogoFrak";
import Link from "next/link";
import styles from "./index.module.css";

export function Header() {
    return (
        <>
            <header className={styles.header}>
                <Link href={"/dashboard"} className={styles.header__logo}>
                    <LogoFrak />
                </Link>
                <NavigationTop />
            </header>
        </>
    );
}
