import { LogoFrak } from "@frak-labs/design-system/icons";
import { motion } from "motion/react";
import * as styles from "./pushNotification.css";

/** iOS banner notification from the Frak app, dropped over the current screen. */
export function PushNotification({
    title,
    body,
    time,
    delay = 0,
}: {
    title: string;
    body: string;
    /** Relative time label, e.g. "maintenant". */
    time: string;
    delay?: number;
}) {
    return (
        <motion.div
            className={styles.banner}
            role="status"
            initial={{ y: -120, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{
                delay,
                type: "spring",
                damping: 22,
                stiffness: 260,
            }}
        >
            <span className={styles.icon}>
                <LogoFrak width={22} height={22} />
            </span>
            <span className={styles.text}>
                <span className={styles.header}>
                    <span className={styles.title}>{title}</span>
                    <span className={styles.time}>{time}</span>
                </span>
                <span className={styles.body}>{body}</span>
            </span>
        </motion.div>
    );
}
