import { Box } from "@frak-labs/design-system/components/Box";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import glassCircleBg from "./glass-circle.webp";
import * as styles from "./index.css";

type GlassButtonBaseProps = {
    /** Icon rendered inside the glass circle. */
    icon: ReactNode;
    disabled?: boolean;
};

type GlassButtonAsButton = GlassButtonBaseProps &
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
        /** Render as interactive `<button>`. Use for standalone glass buttons. */
        as: "button";
    };

type GlassButtonAsSpan = GlassButtonBaseProps &
    Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
        /** Render as `<span>` (default). Use inside `<Back>` or other interactive wrappers. */
        as?: "span";
    };

type GlassButtonProps = GlassButtonAsButton | GlassButtonAsSpan;

/**
 * Frosted-glass circular icon — iOS 26 liquid glass style.
 *
 * - `as="button"` (standalone): renders `<button>` — use for close, share, etc.
 * - `as="span"` (default): renders `<span>` — use inside `<Back>` or `<Link>` to avoid nested buttons.
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

    const content = (
        <>
            <img src={glassCircleBg} alt="" className={styles.glassImage} />
            <Box as="span" className={styles.glassIcon}>
                {icon}
            </Box>
        </>
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
                {content}
            </button>
        );
    }

    return (
        <span
            className={classes}
            aria-disabled={disabled}
            {...(props as Omit<HTMLAttributes<HTMLSpanElement>, "children">)}
        >
            {content}
        </span>
    );
}
