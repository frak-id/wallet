import * as SelectPrimitive from "@radix-ui/react-select";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type { ComponentPropsWithRef } from "react";
import styles from "./index.module.css";

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTriggerVariants = cva(styles.select__trigger, {
    variants: {
        length: {
            medium: styles["select__trigger--medium"],
            big: styles["select__trigger--big"],
        },
    },
});

export type SelectTriggerProps = ComponentPropsWithRef<
    typeof SelectPrimitive.Trigger
> &
    VariantProps<typeof SelectTriggerVariants>;

const SelectTrigger = ({
    ref,
    length,
    className = "",
    children,
    ...props
}: SelectTriggerProps) => (
    <SelectPrimitive.Trigger
        ref={ref}
        className={`${SelectTriggerVariants({
            length,
        })} ${className}`}
        {...props}
    >
        {children}
        <SelectPrimitive.Icon asChild>
            <ChevronDown size={20} className={styles.select__icon} />
        </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
);
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = ({
    ref,
    className = "",
    ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.ScrollUpButton>) => (
    <SelectPrimitive.ScrollUpButton
        ref={ref}
        className={`${styles.select__scrollButton} ${className}`}
        {...props}
    >
        <ChevronUp size={16} />
    </SelectPrimitive.ScrollUpButton>
);
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = ({
    ref,
    className = "",
    ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.ScrollDownButton>) => (
    <SelectPrimitive.ScrollDownButton
        ref={ref}
        className={`${styles.select__scrollButton} ${className}`}
        {...props}
    >
        <ChevronDown size={16} />
    </SelectPrimitive.ScrollDownButton>
);
SelectScrollDownButton.displayName =
    SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = ({
    ref,
    className = "",
    children,
    position = "popper",
    ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.Content>) => (
    <SelectPrimitive.Portal>
        <SelectPrimitive.Content
            ref={ref}
            className={`${styles.select__content} ${className}`}
            position={position}
            {...props}
        >
            <SelectScrollUpButton />
            <SelectPrimitive.Viewport className={`${styles.select__viewport}`}>
                {children}
            </SelectPrimitive.Viewport>
            <SelectScrollDownButton />
        </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
);
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = ({
    ref,
    className = "",
    ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.Label>) => (
    <SelectPrimitive.Label
        ref={ref}
        className={`${styles.select__label} ${className}`}
        {...props}
    />
);
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = ({
    ref,
    className = "",
    children,
    ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.Item>) => (
    <SelectPrimitive.Item
        ref={ref}
        className={`${styles.select__item} ${className}`}
        {...props}
    >
        <span className={styles.select__itemIndicator}>
            <SelectPrimitive.ItemIndicator asChild>
                <Check size={16} />
            </SelectPrimitive.ItemIndicator>
        </span>
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
);
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = ({
    ref,
    className = "",
    ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.Separator>) => (
    <SelectPrimitive.Separator
        ref={ref}
        className={`${styles.select__separator} ${className}`}
        {...props}
    />
);
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
    Select,
    SelectGroup,
    SelectValue,
    SelectTrigger,
    SelectContent,
    SelectLabel,
    SelectItem,
    SelectSeparator,
    SelectScrollUpButton,
    SelectScrollDownButton,
};
