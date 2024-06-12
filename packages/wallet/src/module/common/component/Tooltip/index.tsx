"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import styles from "./index.module.css";

export function Tooltip({
    content,
    hidden = false,
    className = "",
    children,
    side,
    ...props
}: {
    content: string | ReactNode;
    hidden?: boolean;
    className?: string;
    children: ReactNode;
    side?: "top" | "bottom" | "left" | "right";
}) {
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
                        {...props}
                    >
                        {content}
                        <TooltipPrimitive.Arrow
                            className={styles.tooltip__arrow}
                        />
                    </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
    );
}
