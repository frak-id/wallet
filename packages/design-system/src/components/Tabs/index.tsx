import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { RecipeVariants } from "@vanilla-extract/recipes";
import { type ComponentPropsWithRef, useRef, useState } from "react";
import { tabsContent, tabsList, tabsRoot, tabsTrigger } from "./tabs.css";

type ListVariants = NonNullable<RecipeVariants<typeof tabsList>>;
type TriggerVariants = NonNullable<RecipeVariants<typeof tabsTrigger>>;

/**
 * Stateless root — wraps a tab list and its content panels.
 *
 * Accepts `value` / `defaultValue` / `onValueChange` for controlled or
 * uncontrolled usage. Mirrors the shadcn / Radix `<Tabs>` API.
 */
function Tabs({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof TabsPrimitive.Root>) {
    return (
        <TabsPrimitive.Root
            ref={ref}
            className={className ? `${tabsRoot} ${className}` : tabsRoot}
            {...props}
        />
    );
}

/**
 * Container for `TabsTrigger` elements. Renders with `role="tablist"`.
 *
 * `variant` switches between the grey-track `segmented` look (default) and the
 * trackless `navigation` bar (active tab is a floating white pill).
 */
function TabsList({
    ref,
    className,
    variant,
    fullWidth,
    ...props
}: ComponentPropsWithRef<typeof TabsPrimitive.List> & ListVariants) {
    const base = tabsList({ variant, fullWidth });
    return (
        <TabsPrimitive.List
            ref={ref}
            className={className ? `${base} ${className}` : base}
            {...props}
        />
    );
}

/**
 * Individual tab button. Active state is exposed via `data-state="active"`.
 *
 * Pass the same `variant` as the parent `TabsList`.
 */
function TabsTrigger({
    ref,
    className,
    variant,
    fullWidth,
    disabled,
    onMouseDown,
    onFocus,
    onKeyDown,
    onBlur,
    ...props
}: ComponentPropsWithRef<typeof TabsPrimitive.Trigger> & TriggerVariants) {
    // Radix focuses the trigger from code on mousedown, which browsers report
    // as `:focus-visible`; this flag keeps the ring for keyboard focus only.
    const [pointerFocus, setPointerFocus] = useState(false);
    const focusFromPress = useRef(false);
    const base = tabsTrigger({ variant, fullWidth });
    return (
        <TabsPrimitive.Trigger
            ref={ref}
            className={className ? `${base} ${className}` : base}
            disabled={disabled}
            data-pointer-focus={pointerFocus || undefined}
            onMouseDown={(event) => {
                // Same condition under which Radix's own handler focuses.
                focusFromPress.current =
                    !disabled && event.button === 0 && !event.ctrlKey;
                onMouseDown?.(event);
            }}
            onFocus={(event) => {
                setPointerFocus(focusFromPress.current);
                focusFromPress.current = false;
                onFocus?.(event);
            }}
            onKeyDown={(event) => {
                setPointerFocus(false);
                onKeyDown?.(event);
            }}
            onBlur={(event) => {
                focusFromPress.current = false;
                setPointerFocus(false);
                onBlur?.(event);
            }}
            {...props}
        />
    );
}

/**
 * Panel associated with a `TabsTrigger` by matching `value`.
 */
function TabsContent({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof TabsPrimitive.Content>) {
    return (
        <TabsPrimitive.Content
            ref={ref}
            className={className ? `${tabsContent} ${className}` : tabsContent}
            {...props}
        />
    );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
