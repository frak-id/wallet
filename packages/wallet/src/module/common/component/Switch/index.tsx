"use client";

import * as SwitchPrimitives from "@radix-ui/react-switch";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ElementRef } from "react";
import styles from "./index.module.css";

export const Switch = forwardRef<
    ElementRef<typeof SwitchPrimitives.Root>,
    ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
    <SwitchPrimitives.Root
        className={`${styles.switch} ${className}`}
        {...props}
        ref={ref}
    >
        <SwitchPrimitives.Thumb className={styles.switchThumb} />
    </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;
