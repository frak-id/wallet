"use client";

import { Indicator, Item, Root } from "@radix-ui/react-radio-group";
import type { ComponentPropsWithRef } from "react";
import styles from "./index.module.css";

const RadioGroup = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof Root>) => {
    return (
        <Root
            className={`${styles.radioGroup} ${className}`}
            {...props}
            ref={ref}
        />
    );
};
RadioGroup.displayName = Root.displayName;

const RadioGroupItem = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof Item>) => {
    return (
        <Item
            ref={ref}
            className={`${styles.radioGroup__item} ${className}`}
            {...props}
        >
            <Indicator className={`${styles.radioGroup__indicator}`} />
        </Item>
    );
};
RadioGroupItem.displayName = Item.displayName;

export { RadioGroup, RadioGroupItem };
