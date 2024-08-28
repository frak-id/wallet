"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { forwardRef } from "react";
import type { ElementRef, ReactNode } from "react";
import styles from "./index.module.css";

type TooltipProps = {
    content: string | ReactNode;
    hidden?: boolean;
    className?: string;
    children: ReactNode;
    side?: "top" | "bottom" | "left" | "right";
};

export const Tooltip = forwardRef<
    ElementRef<typeof TooltipPrimitive.Provider>,
    TooltipProps
>(
    (
        { content, hidden = false, className = "", children, side, ...props },
        ref
    ) => {
        if (hidden) {
            return children;
        }
        return (
            <TooltipPrimitive.Provider>
                <TooltipPrimitive.Root delayDuration={0}>
                    <TooltipPrimitive.Trigger
                        className={styles.tooltip__trigger}
                        onClick={(e) => e.preventDefault()}
                        asChild
                    >
                        {children}
                    </TooltipPrimitive.Trigger>
                    <TooltipPrimitive.Portal>
                        <TooltipPrimitive.Content
                            onPointerDownOutside={(e) => e.preventDefault()}
                            className={`${styles.tooltip__content} ${className}`}
                            sideOffset={0}
                            side={side}
                            ref={ref}
                            {...props}
                        >
                            <>
                                {content}
                                <TooltipPrimitive.Arrow
                                    className={styles.tooltip__arrow}
                                />
                            </>
                        </TooltipPrimitive.Content>
                    </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>
            </TooltipPrimitive.Provider>
        );
    }
);

Tooltip.displayName = TooltipPrimitive.Provider.displayName;
