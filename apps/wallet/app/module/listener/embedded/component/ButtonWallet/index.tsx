import { Spinner } from "@frak-labs/ui/component/Spinner";
import { type VariantProps, cva, cx } from "class-variance-authority";
import type { ComponentPropsWithRef, ReactNode } from "react";
import styles from "./index.module.css";

type ButtonWalletProps = ComponentPropsWithRef<"button"> &
    VariantProps<typeof buttonWalletVariants> & {
        isLoading?: boolean;
        icon?: ReactNode;
        children?: string | ReactNode;
    };

const buttonWalletVariants = cva(styles.button, {
    variants: {
        variant: {
            primary: styles.primary,
            danger: styles.danger,
            success: styles.success,
            disabled: styles.disabled,
        },
    },
    defaultVariants: {
        variant: "primary",
    },
});

export const ButtonWallet = ({
    ref,
    variant,
    className = "",
    isLoading,
    icon,
    children,
    ...props
}: ButtonWalletProps) => {
    return (
        <div
            className={cx(
                styles.buttonContainer,
                props.disabled && styles["buttonContainer--disabled"]
            )}
        >
            <button
                className={buttonWalletVariants({
                    variant,
                    className,
                })}
                ref={ref}
                type={"button"}
                {...props}
            >
                {isLoading ? <Spinner /> : icon}
            </button>
            {children}
        </div>
    );
};
ButtonWallet.displayName = "ButtonWallet";
