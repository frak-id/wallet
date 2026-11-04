import { LogoFrak } from "@frak-labs/design-system/icons";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import * as styles from "./pushNotification.css";

/** iOS banner notification, dropped over the current screen; the Frak app's unless `icon` says otherwise. */
export function PushNotification({
    title,
    body,
    time,
    delay = 0,
    icon = <LogoFrak width={22} height={22} />,
    onTap,
}: {
    title: string;
    body: string;
    /** Relative time label, e.g. "maintenant". */
    time: string;
    delay?: number;
    icon?: ReactNode;
    /** Makes the banner a button, like tapping a notification to open its app. */
    onTap?: () => void;
}) {
    return (
        <motion.div
            className={styles.banner({ tappable: !!onTap })}
            role={onTap ? "button" : "status"}
            tabIndex={onTap ? 0 : undefined}
            onClick={onTap}
            onKeyDown={(event) => {
                if (onTap && (event.key === "Enter" || event.key === " ")) {
                    onTap();
                }
            }}
            initial={{ y: -120, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{
                delay,
                type: "spring",
                damping: 22,
                stiffness: 260,
            }}
        >
            <span className={styles.icon}>{icon}</span>
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
