import { type VariantProps, cva } from "class-variance-authority";
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
        },
    },
    defaultVariants: {
        variant: "primary",
    },
});

export interface BadgeProps
    extends HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div
            className={`${badgeVariants({
                variant,
            })} ${className}`}
            {...props}
        />
    );
}
Badge.displayName = "Badge";
