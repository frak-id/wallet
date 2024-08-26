import { User } from "lucide-react";
import Link from "next/link";
import styles from "./index.module.css";

export function NavigationProfile() {
    return (
        <Link href="/settings" className={styles.navigationProfile}>
            <span>
                <span className={styles.navigationProfile__avatar}>
                    <User />
                </span>
            </span>
            <span className={styles.navigationProfile__infos}>
                My account
                {/*<span>Jay Hargudson</span>*/}
                {/*<span>Manager</span>*/}
            </span>
        </Link>
    );
}
