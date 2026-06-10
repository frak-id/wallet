import { Indicator, Item, Root } from "@radix-ui/react-radio-group";
import clsx from "clsx";
import type { ComponentPropsWithRef } from "react";
import {
    radioGroup,
    radioGroupIndicator,
    radioGroupIndicatorLarge,
    radioGroupItem,
    radioGroupItemLarge,
} from "./radioGroup.css";

export function RadioGroup({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof Root>) {
    return (
        <Root className={clsx(radioGroup, className)} ref={ref} {...props} />
    );
}

export type RadioGroupItemProps = ComponentPropsWithRef<typeof Item> & {
    /** Radio diameter: `m` = 20px (default), `l` = 24px. */
    size?: "m" | "l";
};

export function RadioGroupItem({
    ref,
    className,
    size = "m",
    ...props
}: RadioGroupItemProps) {
    return (
        <Item
            ref={ref}
            className={clsx(
                radioGroupItem,
                size === "l" && radioGroupItemLarge,
                className
            )}
            {...props}
        >
            <Indicator
                className={clsx(
                    radioGroupIndicator,
                    size === "l" && radioGroupIndicatorLarge
                )}
            />
        </Item>
    );
}
