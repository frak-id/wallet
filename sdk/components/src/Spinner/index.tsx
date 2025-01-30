import { cx } from "class-variance-authority";
import type { ComponentPropsWithRef } from "preact/compat";
import styles from "./index.module.css";

type SpinnerProps = ComponentPropsWithRef<"span"> & {
    className?: string;
};

export const Spinner = ({ ref, className, ...props }: SpinnerProps) => {
    return (
        <span {...props} ref={ref} className={cx(styles.spinner)}>
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
