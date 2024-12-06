import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentPropsWithRef, FC } from "react";
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
    extends ComponentPropsWithRef<"span">,
        VariantProps<typeof badgeVariants> {}

export const Badge: FC<BadgeProps> = ({
    className,
    variant,
    size,
    ref,
    children,
    ...props
}) => {
    return (
        <span
            ref={ref}
            className={badgeVariants({
                variant,
                size,
                className,
            })}
            {...props}
        />
    );
};

Badge.displayName = "Badge";
