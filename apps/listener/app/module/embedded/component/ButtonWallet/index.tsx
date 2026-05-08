import { Spinner } from "@frak-labs/design-system/components/Spinner";
import clsx from "clsx";
import type { ComponentPropsWithRef, ReactNode } from "react";
import * as styles from "./index.css";

type ButtonWalletProps = ComponentPropsWithRef<"button"> & {
    isLoading?: boolean;
    icon?: ReactNode;
    children?: string | ReactNode;
    variant?: keyof typeof styles.variant;
};

export const ButtonWallet = ({
    ref,
    variant = "primary",
    className = "",
    isLoading,
    icon,
    children,
    ...props
}: ButtonWalletProps) => {
    return (
        <div
            className={clsx(
                props.disabled
                    ? styles.buttonContainer.disabled
                    : styles.buttonContainer.default
            )}
        >
            <button
                className={clsx(
                    styles.button,
                    styles.variant[variant],
                    className
                )}
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
