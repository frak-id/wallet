import { Link } from "@tanstack/react-router";
import { User } from "lucide-react";
import styles from "./index.module.css";

export function NavigationProfile() {
    return (
        <Link to="/settings" className={styles.navigationProfile}>
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
