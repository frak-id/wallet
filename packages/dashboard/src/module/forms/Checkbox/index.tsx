"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ElementRef } from "react";
import styles from "./index.module.css";

export const Checkbox = forwardRef<
    ElementRef<typeof CheckboxPrimitive.Root>,
    ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ ...props }, ref) => {
    return (
        <CheckboxPrimitive.Root
            className={styles.checkbox}
            ref={ref}
            {...props}
        >
            <CheckboxPrimitive.Indicator className={styles.checkbox__indicator}>
                {props.checked === "indeterminate" ? (
                    <Minus size={12} />
                ) : (
                    <Check size={17} />
                )}
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    );
});
Checkbox.displayName = "Checkbox";
