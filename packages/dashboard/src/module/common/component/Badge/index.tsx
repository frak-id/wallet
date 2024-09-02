import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import styles from "./index.module.css";

export const badgeVariants = cva(styles.badge, {
    variants: {
        variant: {
            primary: styles.primary,
            secondary: styles.secondary,
            success: styles.success,
            danger: styles.danger,
            information: styles.information,
            warning: styles.warning,
        },
    },
    defaultVariants: {
        variant: "primary",
    },
});

export interface BadgeProps
    extends HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
    ({ className, variant, ...props }, ref) => {
        return (
            <div
                className={`${badgeVariants({
                    variant,
                })} ${className}`}
                ref={ref}
                {...props}
            />
        );
    }
);

Badge.displayName = "Badge";
