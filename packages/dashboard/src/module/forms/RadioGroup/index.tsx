"use client";

import { Indicator, Item, Root } from "@radix-ui/react-radio-group";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ElementRef } from "react";
import styles from "./index.module.css";

const RadioGroup = forwardRef<
    ElementRef<typeof Root>,
    ComponentPropsWithoutRef<typeof Root>
>(({ className, ...props }, ref) => {
    return (
        <Root
            className={`${styles.radioGroup} ${className}`}
            {...props}
            ref={ref}
        />
    );
});
RadioGroup.displayName = Root.displayName;

const RadioGroupItem = forwardRef<
    ElementRef<typeof Item>,
    ComponentPropsWithoutRef<typeof Item>
>(({ className, ...props }, ref) => {
    return (
        <Item
            ref={ref}
            className={`${styles.radioGroup__item} ${className}`}
            {...props}
        >
            <Indicator className={`${styles.radioGroup__indicator}`} />
        </Item>
    );
});
RadioGroupItem.displayName = Item.displayName;

export { RadioGroup, RadioGroupItem };
