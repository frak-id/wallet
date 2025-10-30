import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import styles from "./index.module.css";

const badgeVariants = cva(styles.badge, {
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

export type BadgeProps = ComponentPropsWithRef<"span"> &
    VariantProps<typeof badgeVariants>;

export const Badge = ({
    ref,
    className,
    variant,
    size,
    ...props
}: BadgeProps) => {
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
};

Badge.displayName = "Badge";
