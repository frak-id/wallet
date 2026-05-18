import { Indicator, Item, Root } from "@radix-ui/react-radio-group";
import type { ComponentPropsWithRef } from "react";
import {
    radioGroup,
    radioGroupIndicator,
    radioGroupItem,
} from "./radio-group.css";

const RadioGroup = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof Root>) => {
    return (
        <Root
            className={`${radioGroup}${className ? ` ${className}` : ""}`}
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
            className={`${radioGroupItem}${className ? ` ${className}` : ""}`}
            {...props}
        >
            <Indicator className={radioGroupIndicator} />
        </Item>
    );
};
RadioGroupItem.displayName = Item.displayName;

export { RadioGroup, RadioGroupItem };
