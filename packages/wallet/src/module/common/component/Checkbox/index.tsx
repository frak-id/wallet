import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import {
    type ComponentPropsWithoutRef,
    type ElementRef,
    forwardRef,
} from "react";
import styles from "./index.module.css";

export const Checkbox = forwardRef<
    ElementRef<typeof CheckboxPrimitive.Root>,
    ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ ...props }, ref) => {
    return (
        <CheckboxPrimitive.Root
            className={styles.checkbox__root}
            ref={ref}
            {...props}
        >
            <CheckboxPrimitive.Indicator className={styles.checkbox__indicator}>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <title>Check</title>
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    );
});
Checkbox.displayName = "Checkbox";
