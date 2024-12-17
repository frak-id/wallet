"use client";

import { Root } from "@radix-ui/react-separator";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ComponentRef } from "react";
import styles from "./index.module.css";

export const Separator = forwardRef<
    ComponentRef<typeof Root>,
    ComponentPropsWithoutRef<typeof Root>
>(
    (
        { className, orientation = "horizontal", decorative = true, ...props },
        ref
    ) => (
        <Root
            ref={ref}
            decorative={decorative}
            orientation={orientation}
            className={`${styles.separator} ${className}`}
            {...props}
        />
    )
);
Separator.displayName = Root.displayName;
