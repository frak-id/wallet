import clsx from "clsx";
import { Fingerprint } from "lucide-react";
import type {
    ComponentPropsWithRef,
    PropsWithChildren,
    ReactNode,
} from "react";
import * as styles from "./index.css";

type ButtonAuthSize = keyof typeof styles.size;
type ButtonAuthWidth = keyof typeof styles.width;
type ButtonAuthProps = ComponentPropsWithRef<"button"> & {
    className?: string;
    size?: ButtonAuthSize;
    width?: ButtonAuthWidth;
    isLoading?: boolean;
    children?: ReactNode;
};

export function ButtonAuth({
    type = "button",
    disabled,
    onClick,
    className = "",
    size = "normal",
    isLoading,
    width = "auto",
    children,
}: PropsWithChildren<ButtonAuthProps>) {
    return (
        <button
            type={type}
            className={clsx(
                styles.buttonAuth,
                styles.size[size],
                styles.width[width],
                className
            )}
            disabled={disabled}
            onClick={onClick}
        >
            <span className={styles.buttonAuth__overlay} />

            <span className={styles.buttonAuth__content}>
                <ButtonAuthIcon isLoading={isLoading} />
                <span className={styles.buttonAuth__text}>{children}</span>
            </span>

            <span className={styles.buttonAuth__shimmer} />
        </button>
    );
}

function ButtonAuthIcon({ isLoading }: { isLoading?: boolean }) {
    return (
        <span className={styles.buttonAuth__iconWrapper}>
            <Fingerprint
                className={clsx(
                    styles.buttonAuth__icon,
                    isLoading && styles.buttonAuth__pulsingIcon
                )}
            />

            {isLoading && <div className={styles.buttonAuth__spinner} />}
        </span>
    );
}
