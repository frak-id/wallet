import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import styles from "./index.module.css";

const callOutVariants = cva(styles.callOut, {
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

export type CallOutProps = ComponentPropsWithRef<"p"> &
    VariantProps<typeof callOutVariants>;

export const CallOut = ({
    ref,
    className,
    variant,
    ...props
}: CallOutProps) => {
    return (
        <p
            className={`${callOutVariants({
                variant,
            })} ${className}`}
            ref={ref}
            {...props}
        />
    );
};

CallOut.displayName = "CallOut";
