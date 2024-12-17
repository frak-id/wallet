import type { ComponentPropsWithRef } from "react";
import styles from "./index.module.css";

export const IconInfo = ({ ref, ...props }: ComponentPropsWithRef<"span">) => {
    return (
        <span ref={ref} {...props} className={styles.iconInfo}>
            i
        </span>
    );
};

IconInfo.displayName = "IconInfo";
