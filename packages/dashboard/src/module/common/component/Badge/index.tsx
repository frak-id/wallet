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
            informationReverse: styles.informationReverse,
            warning: styles.warning,
        },
        size: {
            none: styles["size--none"],
            small: styles["size--small"],
            medium: styles["size--medium"],
        },
    },
    defaultVariants: {
        variant: "primary",
        size: "medium",
    },
});

export interface BadgeProps
    extends HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
    ({ className, variant, size, ...props }, ref) => {
        return (
            <span
                className={badgeVariants({
                    variant,
                    size,
                    className,
                })}
                ref={ref}
                {...props}
            />
        );
    }
);

Badge.displayName = "Badge";
