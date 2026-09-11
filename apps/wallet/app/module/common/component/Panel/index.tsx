import { Card } from "@frak-labs/design-system/components/Card";
import type { PropsWithChildren } from "react";
import * as styles from "./index.css";

type PanelVariant = "primary" | "invisible";
type PanelSize = "none" | "small" | "normal" | "big";
type PanelProps = {
    variant?: PanelVariant;
    size?: PanelSize;
    className?: string;
};

export function Panel({
    variant = "primary",
    size = "normal",
    className = "",
    children,
}: PropsWithChildren<PanelProps>) {
    return (
        <Card
            padding="none"
            className={[styles.panel({ variant, size }), className]
                .filter(Boolean)
                .join(" ")}
        >
            {children}
        </Card>
    );
}
