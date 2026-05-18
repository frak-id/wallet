import {
    Tooltip as DSTooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@frak-labs/design-system/components/Tooltip";
import type { ComponentPropsWithRef, ReactNode } from "react";

type TooltipProps = ComponentPropsWithRef<typeof TooltipContent> & {
    content: string | ReactNode;
    hidden?: boolean;
    className?: string;
    children: ReactNode;
    side?: "top" | "bottom" | "left" | "right";
};

/**
 * One-shot Tooltip wrapper — composes the design-system Tooltip primitives
 * with the legacy ergonomic API used across the business app.
 */
export const Tooltip = ({
    content,
    hidden = false,
    className,
    children,
    side,
    ...props
}: TooltipProps) => {
    if (hidden) return children;
    return (
        <TooltipProvider>
            <DSTooltip delayDuration={0}>
                <TooltipTrigger
                    onClick={(e) => e.preventDefault()}
                    asChild
                >
                    {children}
                </TooltipTrigger>
                <TooltipContent
                    onPointerDownOutside={(e) => e.preventDefault()}
                    className={className}
                    sideOffset={0}
                    side={side}
                    {...props}
                >
                    {content}
                </TooltipContent>
            </DSTooltip>
        </TooltipProvider>
    );
};
