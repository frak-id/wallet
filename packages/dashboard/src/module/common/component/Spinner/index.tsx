import { forwardRef } from "react";
import type { ElementRef, HTMLAttributes } from "react";
import styles from "./index.module.css";

type SpinnerElement = ElementRef<"span">;
interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {}

export const Spinner = forwardRef<SpinnerElement, SpinnerProps>(
    (props, forwardedRef) => {
        return (
            <span {...props} ref={forwardedRef} className={styles.spinner}>
                <span className={styles.spinner__leaf} />
                <span className={styles.spinner__leaf} />
                <span className={styles.spinner__leaf} />
                <span className={styles.spinner__leaf} />
                <span className={styles.spinner__leaf} />
                <span className={styles.spinner__leaf} />
                <span className={styles.spinner__leaf} />
                <span className={styles.spinner__leaf} />
            </span>
        );
    }
);
Spinner.displayName = "Spinner";
