import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import * as styles from "./index.css";

type GlassButtonBaseProps = {
    icon: ReactNode;
    disabled?: boolean;
};

type GlassButtonAsButton = GlassButtonBaseProps &
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
        as: "button";
    };

type GlassButtonAsSpan = GlassButtonBaseProps &
    Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
        as?: "span";
    };

export type GlassButtonProps = GlassButtonAsButton | GlassButtonAsSpan;

/**
 * Frosted-glass circular icon.
 *
 * - `as="button"` (standalone): renders `<button>` — use for close, share, etc.
 * - `as="span"` (default): renders `<span>` — use inside `<Back>` / `<Link>` to avoid nested buttons.
 */
export function GlassButton({
    icon,
    disabled,
    className,
    as = "span",
    ...props
}: GlassButtonProps) {
    const classes = [
        styles.glassCircle,
        disabled ? styles.glassCircleDisabled : "",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    const glassContent = (
        <span className={styles.glass}>
            <span className={styles.glassIcon}>{icon}</span>
        </span>
    );

    if (as === "button") {
        return (
            <button
                type="button"
                className={classes}
                disabled={disabled}
                {...(props as Omit<
                    ButtonHTMLAttributes<HTMLButtonElement>,
                    "children"
                >)}
            >
                {glassContent}
            </button>
        );
    }

    return (
        <span
            className={classes}
            aria-disabled={disabled}
            {...(props as Omit<HTMLAttributes<HTMLSpanElement>, "children">)}
        >
            {glassContent}
        </span>
    );
}
