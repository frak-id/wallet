import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { RecipeVariants } from "@vanilla-extract/recipes";
import type { ComponentPropsWithRef } from "react";
import { tabsContent, tabsList, tabsTrigger } from "./tabs.css";

type ListVariants = NonNullable<RecipeVariants<typeof tabsList>>;
type TriggerVariants = NonNullable<RecipeVariants<typeof tabsTrigger>>;

/**
 * Stateless root — wraps a tab list and its content panels.
 *
 * Accepts `value` / `defaultValue` / `onValueChange` for controlled or
 * uncontrolled usage. Mirrors the shadcn / Radix `<Tabs>` API.
 */
const Tabs = TabsPrimitive.Root;

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
    ...props
}: ComponentPropsWithRef<typeof TabsPrimitive.Trigger> & TriggerVariants) {
    const base = tabsTrigger({ variant, fullWidth });
    return (
        <TabsPrimitive.Trigger
            ref={ref}
            className={className ? `${base} ${className}` : base}
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
