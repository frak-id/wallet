"use client";

import { Indicator, Root } from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ComponentRef } from "react";
import styles from "./index.module.css";

export const Checkbox = forwardRef<
    ComponentRef<typeof Root>,
    ComponentPropsWithoutRef<typeof Root>
>(({ ...props }, ref) => {
    return (
        <Root className={styles.checkbox} ref={ref} {...props}>
            <Indicator className={styles.checkbox__indicator}>
                {props.checked === "indeterminate" ? (
                    <Minus size={12} />
                ) : (
                    <Check size={17} />
                )}
            </Indicator>
        </Root>
    );
});
Checkbox.displayName = "Checkbox";
