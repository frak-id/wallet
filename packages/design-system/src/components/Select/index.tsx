import * as SelectPrimitive from "@radix-ui/react-select";
import type { RecipeVariants } from "@vanilla-extract/recipes";
import clsx from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ComponentPropsWithRef } from "react";
import { ChevronDownIcon } from "../../icons";
import { selectStyles, triggerLength } from "./select.css";

export const Select = SelectPrimitive.Root;

export const SelectGroup = SelectPrimitive.Group;

export const SelectValue = SelectPrimitive.Value;

type SelectTriggerLength = NonNullable<
    RecipeVariants<typeof triggerLength>
>["length"];

export type SelectTriggerProps = ComponentPropsWithRef<
    typeof SelectPrimitive.Trigger
> & {
    /** Preset width: `medium` (320 px) or `big` (100 %). */
    length?: SelectTriggerLength;
    /**
     * `"bare"` — borderless 56px flat card (pairs with `Input variant="bare"`;
     * `length` is ignored). Use `tone` to pick the surface.
     */
    variant?: "default" | "bare";
    /** Surface tone for `variant="bare"`: `elevated` (white) or `muted`. */
    tone?: "elevated" | "muted";
};

export function SelectTrigger({
    ref,
    length,
    variant = "default",
    tone,
    className,
    children,
    ...props
}: SelectTriggerProps) {
    const base =
        variant === "bare"
            ? clsx(
                  selectStyles.triggerBare,
                  tone === "muted" && selectStyles.triggerBareMuted
              )
            : clsx(selectStyles.trigger, length && triggerLength({ length }));
    const combined = clsx(base, className);

    return (
        <SelectPrimitive.Trigger ref={ref} className={combined} {...props}>
            {children}
            <SelectPrimitive.Icon asChild>
                <ChevronDownIcon
                    width={24}
                    height={24}
                    className={selectStyles.icon}
                />
            </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
    );
}

function SelectScrollUpButton(
    props: ComponentPropsWithRef<typeof SelectPrimitive.ScrollUpButton>
) {
    const { ref, className, ...rest } = props;
    return (
        <SelectPrimitive.ScrollUpButton
            ref={ref}
            className={clsx(selectStyles.scrollButton, className)}
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
            className={clsx(selectStyles.scrollButton, className)}
            {...rest}
        >
            <ChevronDown size={16} />
        </SelectPrimitive.ScrollDownButton>
    );
}

export function SelectContent({
    ref,
    className,
    children,
    position = "popper",
    sideOffset = 8,
    ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.Content>) {
    const combined = clsx(selectStyles.content, className);

    return (
        <SelectPrimitive.Portal>
            <SelectPrimitive.Content
                ref={ref}
                className={combined}
                position={position}
                sideOffset={sideOffset}
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

export function SelectItem({
    ref,
    className,
    children,
    ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.Item>) {
    const combined = clsx(selectStyles.item, className);

    return (
        <SelectPrimitive.Item ref={ref} className={combined} {...props}>
            <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        </SelectPrimitive.Item>
    );
}

export function SelectLabel({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.Label>) {
    const combined = clsx(selectStyles.label, className);

    return <SelectPrimitive.Label ref={ref} className={combined} {...props} />;
}

export function SelectSeparator({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.Separator>) {
    const combined = clsx(selectStyles.separator, className);

    return (
        <SelectPrimitive.Separator ref={ref} className={combined} {...props} />
    );
}
