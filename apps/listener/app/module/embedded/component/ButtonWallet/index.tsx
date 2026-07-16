import { Spinner } from "@frak-labs/design-system/components/Spinner";
import type { RecipeVariants } from "@vanilla-extract/recipes";
import clsx from "clsx";
import type { ComponentPropsWithRef, ReactNode } from "react";
import * as styles from "./index.css";

type ButtonWalletProps = ComponentPropsWithRef<"button"> & {
    isLoading?: boolean;
    icon?: ReactNode;
    children?: string | ReactNode;
    variant?: NonNullable<RecipeVariants<typeof styles.button>>["variant"];
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
        <div className={styles.buttonContainer({ disabled: !!props.disabled })}>
            <button
                className={clsx(styles.button({ variant }), className)}
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
