import { NavigationTop } from "@/module/common/component/NavigationTop";
import { LogoFrak } from "@frak-labs/ui/icons/LogoFrak";
import Link from "next/link";
import styles from "./index.module.css";

export function Header() {
    return (
        <div>
            <header className={styles.header}>
                <Link href={"/dashboard"} className={styles.header__logo}>
                    <LogoFrak />
                </Link>
                <NavigationTop />
            </header>
        </div>
    );
}
