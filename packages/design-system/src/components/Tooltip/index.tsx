import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { tooltipArrow, tooltipContent } from "./tooltip.css";

/**
 * Re-export the Radix provider — wrap your app tree once.
 */
export const TooltipProvider = RadixTooltip.Provider;

/**
 * Stateless root — pairs trigger + content.
 */
export const Tooltip = RadixTooltip.Root;

/**
 * Element that opens the tooltip on hover/focus.
 */
export const TooltipTrigger = RadixTooltip.Trigger;

type TooltipContentProps = ComponentPropsWithRef<
    typeof RadixTooltip.Content
> & {
    children: ReactNode;
    /** Hide the default arrow */
    hideArrow?: boolean;
};

/**
 * Styled tooltip content — portaled, animated, with optional arrow.
 */
export function TooltipContent({
    children,
    hideArrow = false,
    className,
    sideOffset = 4,
    ...props
}: TooltipContentProps) {
    const combinedClassName = [tooltipContent, className]
        .filter(Boolean)
        .join(" ");

    return (
        <RadixTooltip.Portal>
            <RadixTooltip.Content
                className={combinedClassName}
                sideOffset={sideOffset}
                {...props}
            >
                {children}
                {!hideArrow && <RadixTooltip.Arrow className={tooltipArrow} />}
            </RadixTooltip.Content>
        </RadixTooltip.Portal>
    );
}
