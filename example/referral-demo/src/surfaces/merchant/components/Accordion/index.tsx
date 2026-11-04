import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useState } from "react";
import { ChevronDownIcon } from "../icons";
import * as styles from "./accordion.css";

export function Accordion({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className={styles.item}>
            <button
                type="button"
                className={styles.trigger}
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
            >
                {title}
                <ChevronDownIcon
                    size={18}
                    className={
                        open
                            ? `${styles.chevron} ${styles.chevronOpen}`
                            : styles.chevron
                    }
                />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        className={styles.panel}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.26, ease: "easeOut" }}
                    >
                        <p className={styles.body}>{children}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
