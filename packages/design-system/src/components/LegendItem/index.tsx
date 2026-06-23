import clsx from "clsx";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { Text } from "../Text";
import { legendItem, swatch } from "./legendItem.css";

export type LegendItemProps = ComponentPropsWithRef<"div"> & {
    /** Swatch colour — any CSS color, typically a `vars.*` token. */
    swatchColor: string;
    /** `inline` = swatch beside the label (default); `stacked` = above it. */
    layout?: "inline" | "stacked";
    /** Label content, rendered as caption text. */
    children: ReactNode;
};

/**
 * One chart-legend entry: an 8px rounded swatch plus a caption label.
 * Shared by the distribution/status bars and the overview chart cards.
 */
export function LegendItem({
    swatchColor,
    layout = "inline",
    children,
    className,
    ...rest
}: LegendItemProps) {
    return (
        <div className={clsx(legendItem[layout], className)} {...rest}>
            <span
                className={swatch}
                style={{ backgroundColor: swatchColor }}
                aria-hidden="true"
            />
            <Text as="span" variant="caption">
                {children}
            </Text>
        </div>
    );
}
