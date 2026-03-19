import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type { ComponentPropsWithRef } from "react";
import { selectStyles, triggerLength } from "./select.css";

/**
 * Root — stateless wrapper pairing trigger + content.
 */
export const Select = SelectPrimitive.Root;

/**
 * Group — groups related items under a label.
 */
export const SelectGroup = SelectPrimitive.Group;

/**
 * Value — displays the selected value inside the trigger.
 */
export const SelectValue = SelectPrimitive.Value;

/* ------------------------------------------------------------------ */
/*  Trigger                                                           */
/* ------------------------------------------------------------------ */

type SelectTriggerLength = keyof typeof triggerLength;

export type SelectTriggerProps = ComponentPropsWithRef<
    typeof SelectPrimitive.Trigger
> & {
    /** Preset width: `medium` (320 px) or `big` (100 %). */
    length?: SelectTriggerLength;
};

export function SelectTrigger({
    ref,
    length,
    className,
    children,
    ...props
}: SelectTriggerProps) {
    const base = length ? triggerLength[length] : selectStyles.trigger;
    const combined = [base, className].filter(Boolean).join(" ");

    return (
        <SelectPrimitive.Trigger ref={ref} className={combined} {...props}>
            {children}
            <SelectPrimitive.Icon asChild>
                <ChevronDown size={20} className={selectStyles.icon} />
            </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
    );
}

/* ------------------------------------------------------------------ */
/*  Scroll buttons                                                    */
/* ------------------------------------------------------------------ */

function SelectScrollUpButton(
    props: ComponentPropsWithRef<typeof SelectPrimitive.ScrollUpButton>
) {
    const { ref, className, ...rest } = props;
    return (
        <SelectPrimitive.ScrollUpButton
            ref={ref}
            className={
                className
                    ? `${selectStyles.scrollButton} ${className}`
                    : selectStyles.scrollButton
            }
            {...rest}
        >
            <ChevronUp size={16} />
        </SelectPrimitive.ScrollUpButton>
    );
}

function SelectScrollDownButton(
    props: ComponentPropsWithRef<typeof SelectPrimitive.ScrollDownButton>
) {
    const { ref, className, ...rest } = props;
    return (
        <SelectPrimitive.ScrollDownButton
            ref={ref}
            className={
                className
                    ? `${selectStyles.scrollButton} ${className}`
                    : selectStyles.scrollButton
            }
            {...rest}
        >
            <ChevronDown size={16} />
        </SelectPrimitive.ScrollDownButton>
    );
}

/* ------------------------------------------------------------------ */
/*  Content                                                           */
/* ------------------------------------------------------------------ */

export function SelectContent({
    ref,
    className,
    children,
    position = "popper",
    ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.Content>) {
    const combined = [selectStyles.content, className]
        .filter(Boolean)
        .join(" ");

    return (
        <SelectPrimitive.Portal>
            <SelectPrimitive.Content
                ref={ref}
                className={combined}
                position={position}
                {...props}
            >
                <SelectScrollUpButton />
                <SelectPrimitive.Viewport className={selectStyles.viewport}>
                    {children}
                </SelectPrimitive.Viewport>
                <SelectScrollDownButton />
            </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
    );
}

/* ------------------------------------------------------------------ */
/*  Item                                                              */
/* ------------------------------------------------------------------ */

export function SelectItem({
    ref,
    className,
    children,
    ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.Item>) {
    const combined = [selectStyles.item, className].filter(Boolean).join(" ");

    return (
        <SelectPrimitive.Item ref={ref} className={combined} {...props}>
            <span className={selectStyles.itemIndicator}>
                <SelectPrimitive.ItemIndicator asChild>
                    <Check size={16} />
                </SelectPrimitive.ItemIndicator>
            </span>
            <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        </SelectPrimitive.Item>
    );
}

/* ------------------------------------------------------------------ */
/*  Label                                                             */
/* ------------------------------------------------------------------ */

export function SelectLabel({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.Label>) {
    const combined = [selectStyles.label, className].filter(Boolean).join(" ");

    return <SelectPrimitive.Label ref={ref} className={combined} {...props} />;
}

/* ------------------------------------------------------------------ */
/*  Separator                                                         */
/* ------------------------------------------------------------------ */

export function SelectSeparator({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.Separator>) {
    const combined = [selectStyles.separator, className]
        .filter(Boolean)
        .join(" ");

    return (
        <SelectPrimitive.Separator ref={ref} className={combined} {...props} />
    );
}
