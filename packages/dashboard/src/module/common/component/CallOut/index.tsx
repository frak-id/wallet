import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import styles from "./index.module.css";

export const callOutVariants = cva(styles.callOut, {
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

export interface CallOutProps
    extends HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof callOutVariants> {}

export const CallOut = forwardRef<HTMLDivElement, CallOutProps>(
    ({ className, variant, ...props }, ref) => {
        return (
            <div
                className={`${callOutVariants({
                    variant,
                })} ${className}`}
                ref={ref}
                {...props}
            />
        );
    }
);

CallOut.displayName = "CallOut";
