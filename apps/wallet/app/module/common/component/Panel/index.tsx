import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { X } from "lucide-react";
import { type PropsWithChildren, useCallback, useState } from "react";
import * as styles from "./index.css";

/**
 * localStorage key prefix for dismissed panels.
 * Keys matching this prefix are cleared on logout.
 */
export const panelDismissedPrefix = "frak_panel_dismissed:";

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
    /**
     * When true, shows a dismiss button.
     * Pair with `dismissKey` to persist the dismissed state across sessions.
     */
    isDismissible?: boolean;
    /**
     * Unique key to persist the dismissed state in localStorage.
     * When provided, dismissing the panel is permanent until logout.
     */
    dismissKey?: string;
};

export function Panel({
    variant = "primary",
    size = "normal",
    withShadow = false,
    asChild = false,
    className = "",
    cover,
    isDismissible = false,
    dismissKey,
    children,
}: PropsWithChildren<PanelProps>) {
    void asChild;
    const storageKey = dismissKey
        ? `${panelDismissedPrefix}${dismissKey}`
        : undefined;

    const [isVisible, setIsVisible] = useState(() => {
        if (!storageKey) return true;
        return localStorage.getItem(storageKey) === null;
    });

    const handleDismiss = useCallback(() => {
        if (storageKey) {
            localStorage.setItem(storageKey, "1");
        }
        setIsVisible(false);
    }, [storageKey]);

    if (!isVisible) {
        return null;
    }

    const backgroundStyle = cover ? { backgroundImage: `url(${cover})` } : {};

    const renderDismissButton = () => {
        if (!isDismissible) return null;

        return (
            <Box
                as="button"
                type="button"
                className={styles.dismissButton}
                onClick={handleDismiss}
            >
                <X />
            </Box>
        );
    };
    void asChild;

    return (
        <Card
            padding="none"
            className={[
                styles.panel,
                styles.variant[variant],
                styles.size[size],
                withShadow ? styles.shadow : undefined,
                styles.dismissible,
                className,
            ]
                .filter(Boolean)
                .join(" ")}
            style={backgroundStyle}
        >
            {children}
            {renderDismissButton()}
        </Card>
    );
}
