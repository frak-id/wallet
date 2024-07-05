import { Button } from "@module/component/Button";
import { forwardRef } from "react";
import type { ReactNode } from "react";
import styles from "./index.module.css";

type ButtonProductProps = {
    children: ReactNode;
};

export const ButtonProduct = forwardRef<HTMLButtonElement, ButtonProductProps>(
    ({ children, ...props }, ref) => {
        return (
            <Button
                size={"none"}
                className={styles.buttonProduct}
                ref={ref}
                {...props}
            >
                {children}
            </Button>
        );
    }
);
ButtonProduct.displayName = "ButtonProduct";
