import { type VariantProps, cva, cx } from "class-variance-authority";
import { Fingerprint } from "lucide-react";
import type {
    ComponentPropsWithRef,
    PropsWithChildren,
    ReactNode,
} from "react";
import styles from "./index.module.css";

type ButtonAuthSize = "none" | "small" | "normal" | "big";
type ButtonAuthProps = ComponentPropsWithRef<"button"> &
    VariantProps<typeof buttonAuthVariants> & {
        className?: string;
        size?: ButtonAuthSize;
        isLoading?: boolean;
        children?: ReactNode;
    };

const buttonAuthVariants = cva(styles.buttonAuth, {
    variants: {
        size: {
            none: styles["size--none"],
            small: styles["size--small"],
            normal: styles["size--normal"],
            big: styles["size--big"],
        },
        width: {
            auto: styles["width--auto"],
            full: styles["width--full"],
        },
    },
    defaultVariants: {
        size: "normal",
        width: "auto",
    },
});

export function ButtonAuth({
    type = "button",
    disabled,
    onClick,
    className = "",
    size,
    isLoading,
    width,
    children,
}: PropsWithChildren<ButtonAuthProps>) {
    return (
        <button
            type={type}
            className={buttonAuthVariants({
                size,
                className,
                width,
            })}
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
                className={cx(
                    styles.buttonAuth__icon,
                    isLoading && styles.buttonAuth__pulsingIcon
                )}
            />

            {isLoading && <div className={styles.buttonAuth__spinner} />}
        </span>
    );
}
