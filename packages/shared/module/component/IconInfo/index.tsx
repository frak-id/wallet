import { forwardRef } from "react";
import styles from "./index.module.css";

export const IconInfo = forwardRef<HTMLSpanElement>((props, ref) => {
    return (
        <span ref={ref} {...props} className={styles.iconInfo}>
            i
        </span>
    );
});

IconInfo.displayName = "IconInfo";
