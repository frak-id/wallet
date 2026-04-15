import { Fingerprint } from "lucide-react";
import type { ComponentPropsWithRef, PropsWithChildren } from "react";
import * as styles from "./index.css";

type ButtonAuthProps = ComponentPropsWithRef<"button"> & {
    isLoading?: boolean;
};

export function ButtonAuth({
    type = "button",
    disabled,
    onClick,
    className,
    isLoading,
    children,
}: PropsWithChildren<ButtonAuthProps>) {
    const combinedClassName = [styles.buttonAuth, className]
        .filter(Boolean)
        .join(" ");

    return (
        <button
            type={type}
            className={combinedClassName}
            disabled={disabled}
            onClick={onClick}
        >
            <span className={styles.overlay} />

            <span className={styles.content}>
                <ButtonAuthIcon isLoading={isLoading} />
                <span className={styles.text}>{children}</span>
            </span>

            <span className={styles.shimmer} />
        </button>
    );
}

function ButtonAuthIcon({ isLoading }: { isLoading?: boolean }) {
    const iconClassName = [styles.icon, isLoading && styles.pulsingIcon]
        .filter(Boolean)
        .join(" ");

    return (
        <span className={styles.iconWrapper}>
            <Fingerprint className={iconClassName} />
            {isLoading && <div className={styles.spinner} />}
        </span>
    );
}
