"use client";
import { Indicator, Root } from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import type { ComponentPropsWithRef } from "react";
import styles from "./index.module.css";

export const Checkbox = ({
    ref,
    ...props
}: ComponentPropsWithRef<typeof Root>) => {
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
};
Checkbox.displayName = "Checkbox";
