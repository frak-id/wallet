"use client";

import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ElementRef } from "react";
import styles from "./index.module.css";

export const Separator = forwardRef<
    ElementRef<typeof SeparatorPrimitive.Root>,
    ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
    (
        { className, orientation = "horizontal", decorative = true, ...props },
        ref
    ) => (
        <SeparatorPrimitive.Root
            ref={ref}
            decorative={decorative}
            orientation={orientation}
            className={`${styles.separator} ${className}`}
            {...props}
        />
    )
);
Separator.displayName = SeparatorPrimitive.Root.displayName;
