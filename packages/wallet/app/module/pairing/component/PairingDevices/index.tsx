import { Laptop, Smartphone } from "lucide-react";
import styles from "./index.module.css";

export function PairingDevices() {
    return (
        <div className={styles.devices}>
            <div className={styles.device}>
                <div
                    className={`${styles.device__icon} ${styles["device__icon--mobile"]}`}
                >
                    <Smartphone />
                </div>
                <span className={styles.device__label}>Mobile</span>
            </div>
            <div className={styles.connector} />
            <div className={styles.device}>
                <div
                    className={`${styles.device__icon} ${styles["device__icon--desktop"]}`}
                >
                    <Laptop />
                </div>
                <span className={styles.device__label}>Desktop</span>
            </div>
        </div>
    );
}
