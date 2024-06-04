"use client";

import { Label } from "@/module/forms/Label";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { type ReactNode, forwardRef } from "react";
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
                <Check size={17} />
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    );
});
Checkbox.displayName = "Checkbox";

export function CheckboxWithLabel({
    label,
    id,
    ...props
}: { label: ReactNode; id: string } & ComponentPropsWithoutRef<
    typeof CheckboxPrimitive.Root
>) {
    return (
        <p className={styles.checkboxWithLabel}>
            <span>
                <Checkbox id={id} {...props} />
            </span>
            <Label htmlFor={id} className={styles.checkboxWithLabel__label}>
                {label}
            </Label>
        </p>
    );
}
CheckboxWithLabel.displayName = "CheckboxWithLabel";
