import { Box } from "@frak-labs/design-system/components/Box";
import { CircleCheckIcon } from "@frak-labs/design-system/icons";
import { useEffect, useState } from "react";
import * as styles from "./index.css";

type SuccessOverlayProps = {
    visible: boolean;
    onDone: () => void;
    duration?: number;
};

export function SuccessOverlay({
    visible,
    onDone,
    duration = 3000,
}: SuccessOverlayProps) {
    const [fading, setFading] = useState(false);

    // Reset fading state when overlay becomes visible again
    useEffect(() => {
        if (visible) {
            setFading(false);
        }
    }, [visible]);

    useEffect(() => {
        if (!visible) return;

        const fadeTimer = setTimeout(() => setFading(true), duration);
        const doneTimer = setTimeout(() => onDone(), duration + 300);

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(doneTimer);
        };
    }, [visible, duration, onDone]);

    if (!visible) return null;

    return (
        <Box
            className={`${styles.overlay} ${fading ? styles.overlayFadeOut : ""}`}
        >
            <Box className={styles.card}>
                <CircleCheckIcon
                    width={64}
                    height={64}
                    className={styles.icon}
                />
            </Box>
        </Box>
    );
}
