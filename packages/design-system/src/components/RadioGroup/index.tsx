import { Indicator, Item, Root } from "@radix-ui/react-radio-group";
import type { ComponentPropsWithRef } from "react";
import {
    radioGroup,
    radioGroupIndicator,
    radioGroupItem,
} from "./radioGroup.css";

export function RadioGroup({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof Root>) {
    const combinedClassName = [radioGroup, className].filter(Boolean).join(" ");
    return <Root className={combinedClassName} ref={ref} {...props} />;
}

export function RadioGroupItem({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof Item>) {
    const combinedClassName = [radioGroupItem, className]
        .filter(Boolean)
        .join(" ");
    return (
        <Item ref={ref} className={combinedClassName} {...props}>
            <Indicator className={radioGroupIndicator} />
        </Item>
    );
}
