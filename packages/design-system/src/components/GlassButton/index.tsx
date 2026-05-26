import { LiquidGlassBase } from "@tinymomentum/liquid-glass-react";
import "@tinymomentum/liquid-glass-react/dist/components/LiquidGlassBase.css";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import * as styles from "./index.css";

const glassConfig = {
    width: 44,
    height: 44,
    borderRadius: 50,
    innerShadowColor: "#ffffff",
    innerShadowBlur: 15,
    innerShadowSpread: -5,
    glassTintColor: "#f7f7f7",
    glassTintOpacity: 80,
    frostBlurRadius: 3,
    noiseFrequency: 0.008,
    noiseStrength: 1,
} as const;

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
 * Frosted-glass circular icon — iOS 26 liquid glass via @tinymomentum/liquid-glass-react.
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
        <>
            {/* Runtime <style> bypasses Lightning CSS which converts backdrop-filter
               to -webkit-backdrop-filter only (safari 14 target), rejected as invalid. */}
            <style
                href="liquid-glass-backdrop"
                precedence="default"
            >{`.liquid-glass::after{backdrop-filter:blur(var(--frost-blur-radius))}`}</style>
            <LiquidGlassBase {...glassConfig}>
                <span className={styles.glassIcon}>{icon}</span>
            </LiquidGlassBase>
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
