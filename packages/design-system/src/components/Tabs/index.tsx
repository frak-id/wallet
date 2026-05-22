import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentPropsWithRef } from "react";
import { tabsStyles } from "./tabs.css";

/**
 * Stateless root — wraps a tab list and its content panels.
 *
 * Accepts `value` / `defaultValue` / `onValueChange` for controlled or
 * uncontrolled usage. Mirrors the shadcn / Radix `<Tabs>` API.
 */
const Tabs = TabsPrimitive.Root;

/**
 * Container for `TabsTrigger` elements. Renders with `role="tablist"`.
 */
function TabsList({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof TabsPrimitive.List>) {
    return (
        <TabsPrimitive.List
            ref={ref}
            className={
                className ? `${tabsStyles.list} ${className}` : tabsStyles.list
            }
            {...props}
        />
    );
}

/**
 * Individual tab button. Active state is exposed via `data-state="active"`.
 */
function TabsTrigger({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof TabsPrimitive.Trigger>) {
    return (
        <TabsPrimitive.Trigger
            ref={ref}
            className={
                className
                    ? `${tabsStyles.trigger} ${className}`
                    : tabsStyles.trigger
            }
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
            className={
                className
                    ? `${tabsStyles.content} ${className}`
                    : tabsStyles.content
            }
            {...props}
        />
    );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
