import { Fingerprint } from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

type ButtonAuthProps = {
    type?: "button" | "submit";
    onClick?: () => void;
    disabled?: boolean;
    icon?: ReactNode;
    className?: string;
    size?: "none" | "small" | "normal" | "big";
    isLoading?: boolean;
};

export function ButtonAuth({
    children,
    type = "button",
    disabled,
    onClick,
    className = "",
    size,
    isLoading,
}: PropsWithChildren<ButtonAuthProps>) {
    return (
        <button
            type={type}
            className={`${styles.mainButton} ${isLoading ? styles.authenticating : ""}`}
            disabled={disabled}
            onClick={onClick}
        >
            <div className={styles.buttonOverlay} />

            <div className={styles.buttonContent}>
                <div className={styles.iconContainer}>
                    <div className={styles.iconWrapper}>
                        <Fingerprint
                            className={`${styles.icon} ${isLoading ? styles.pulsingIcon : ""}`}
                        />

                        {isLoading && <div className={styles.spinner} />}
                    </div>
                </div>

                <div className={styles.textContainer}>
                    <div className={styles.secondaryText}>{children}</div>
                </div>
            </div>

            <div className={styles.shimmer} />
        </button>
    );
}
