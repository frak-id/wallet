import styles from "./index.module.css";

export function NavigationProfile() {
    return (
        <div className={styles.navigationProfile}>
            <div>
                <span className={styles.navigationProfile__avatar}>&nbsp;</span>
            </div>
            <div className={styles.navigationProfile__infos}>
                <span>Jay Hargudson</span>
                <span>Manager</span>
            </div>
        </div>
    );
}
