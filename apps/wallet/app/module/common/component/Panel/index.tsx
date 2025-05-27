import { Slot } from "@radix-ui/react-slot";
import { cx } from "class-variance-authority";
import { X } from "lucide-react";
import { type PropsWithChildren, useState } from "react";
import styles from "./index.module.css";

type PanelVariant =
    | "primary"
    | "secondary"
    | "outlined"
    | "empty"
    | "invisible";
type PanelSize = "none" | "small" | "normal" | "big";
type PanelProps = {
    variant?: PanelVariant;
    size?: PanelSize;
    withShadow?: boolean;
    asChild?: boolean;
    className?: string;
    cover?: string;
    isDismissible?: boolean;
};

export function Panel({
    variant = "primary",
    size = "normal",
    withShadow = false,
    asChild = false,
    className = "",
    cover,
    isDismissible = false,
    children,
}: PropsWithChildren<PanelProps>) {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) {
        return null;
    }

    const backgroundStyle = cover ? { backgroundImage: `url(${cover})` } : {};

    const Component = asChild ? Slot : "div";

    const renderDismissButton = () => {
        if (!isDismissible) return null;

        return (
            <button
                type="button"
                className={styles.dismissible__button}
                onClick={() => setIsVisible(false)}
            >
                <X />
            </button>
        );
    };

    return (
        <Component
            className={cx(
                styles.panel,
                styles[variant],
                styles[`size--${size}`],
                withShadow && styles.shadow,
                styles.dismissible,
                className
            )}
            style={backgroundStyle}
        >
            {children}
            {renderDismissButton()}
        </Component>
    );
}
