import { Slot } from "@radix-ui/react-slot";
import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type PanelProps = {
    variant?: "primary" | "secondary" | "outlined" | "empty" | "invisible";
    size?: "none" | "small" | "normal" | "big";
    withShadow?: boolean;
    asChild?: boolean;
    className?: string;
    cover?: string;
};

export function Panel({
    variant,
    size,
    withShadow,
    asChild = false,
    className = "",
    cover,
    children,
}: PropsWithChildren<PanelProps>) {
    const variantClass = variant ? styles[variant] : styles.primary;
    const sizeClass = size ? styles[`size--${size}`] : styles["size--normal"];
    const shadowClass = withShadow ? styles.shadow : "";
    const stylesInline = cover ? { backgroundImage: `url(${cover})` } : {};
    const Comp = asChild ? Slot : "div";
    return (
        <Comp
            className={`${styles.panel} ${className} ${variantClass} ${sizeClass} ${shadowClass}`}
            style={stylesInline}
        >
            {children}
        </Comp>
    );
}
