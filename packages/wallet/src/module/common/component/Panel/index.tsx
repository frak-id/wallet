import { Slot } from "@radix-ui/react-slot";
import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type PanelProps = {
    variant?: "primary" | "secondary" | "outlined";
    size?: "none" | "small" | "normal" | "big";
    withShadow?: boolean;
    asChild?: boolean;
};

export function Panel({
    variant,
    size,
    withShadow,
    asChild = false,
    children,
}: PropsWithChildren<PanelProps>) {
    const variantClass = variant ? styles[variant] : styles.primary;
    const sizeClass = size ? styles[`size--${size}`] : styles["size--normal"];
    const shadowClass = withShadow ? styles.shadow : "";
    const Comp = asChild ? Slot : "div";
    return (
        <Comp
            className={`${styles.panel} ${variantClass} ${sizeClass} ${shadowClass}`}
        >
            {children}
        </Comp>
    );
}
