import { cx } from "class-variance-authority";
import type { ComponentPropsWithRef, RefObject } from "react";
import styles from "./index.module.css";

type SpinnerProps = ComponentPropsWithRef<"span"> & {
    className?: string;
};

export const Spinner = ({ ref, className, ...props }: SpinnerProps) => {
    return (
        <span
            {...props}
            ref={ref as RefObject<HTMLSpanElement>}
            className={cx(styles.spinner, className)}
        >
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
};
Spinner.displayName = "Spinner";
