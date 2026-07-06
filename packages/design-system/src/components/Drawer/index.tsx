import clsx from "clsx";
import type { ComponentProps, ComponentPropsWithRef } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import {
    drawerContentEdgeStyle,
    drawerContentMutedStyle,
    drawerContentStyle,
    drawerContentWrapperEdgeStyle,
    drawerContentWrapperStyle,
    drawerFooterStyle,
    drawerHandleStyle,
    drawerHeaderStyle,
    drawerOverlayStyle,
} from "./drawer.css";

/**
 * Root drawer — wraps Vaul with sensible defaults.
 */
export function Drawer({
    shouldScaleBackground = true,
    ...props
}: ComponentProps<typeof DrawerPrimitive.Root>) {
    return (
        <DrawerPrimitive.Root
            shouldScaleBackground={shouldScaleBackground}
            {...props}
        />
    );
}

/**
 * Element that opens the drawer on click.
 */
export const DrawerTrigger = DrawerPrimitive.Trigger;

/**
 * Overlay backdrop behind the drawer — fades in on open.
 */
export function DrawerOverlay({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof DrawerPrimitive.Overlay>) {
    return (
        <DrawerPrimitive.Overlay
            ref={ref}
            className={clsx(drawerOverlayStyle, className)}
            {...props}
        />
    );
}

/**
 * Styled drawer content — portaled, animated, with overlay.
 *
 * When `hideHandle` is true the consumer **must** provide their own
 * `<DrawerTitle>` for a11y.
 *
 * `edgeToEdge` drops the default side + bottom margins so the sheet sits flush
 * against the screen edges (square bottom corners, safe-area bottom padding).
 *
 * `surface="muted"` swaps the elevated white content bg for a grey surface so
 * nested white cards read with contrast.
 */
export function DrawerContent({
    ref,
    className,
    contentClassName,
    children,
    hideHandle,
    edgeToEdge,
    surface = "default",
    ...props
}: ComponentPropsWithRef<typeof DrawerPrimitive.Content> & {
    hideHandle?: boolean;
    contentClassName?: string;
    edgeToEdge?: boolean;
    surface?: "default" | "muted";
}) {
    const contentClass = clsx(
        drawerContentStyle,
        edgeToEdge && drawerContentEdgeStyle,
        surface === "muted" && drawerContentMutedStyle,
        contentClassName
    );
    return (
        <DrawerPrimitive.Portal>
            <DrawerOverlay />
            <DrawerPrimitive.Content
                ref={ref}
                className={clsx(
                    drawerContentWrapperStyle,
                    edgeToEdge && drawerContentWrapperEdgeStyle,
                    className
                )}
                {...props}
            >
                {hideHandle ? (
                    <div className={contentClass}>{children}</div>
                ) : (
                    <>
                        <DrawerPrimitive.Title asChild>
                            <div className={drawerHandleStyle} />
                        </DrawerPrimitive.Title>
                        <DrawerPrimitive.Description asChild>
                            <div className={contentClass}>{children}</div>
                        </DrawerPrimitive.Description>
                    </>
                )}
            </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
    );
}

/**
 * Accessible title for the drawer.
 */
export function DrawerTitle({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof DrawerPrimitive.Title>) {
    return <DrawerPrimitive.Title ref={ref} className={className} {...props} />;
}

/**
 * Accessible description for the drawer.
 */
export function DrawerDescription({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof DrawerPrimitive.Description>) {
    return (
        <DrawerPrimitive.Description
            ref={ref}
            className={className}
            {...props}
        />
    );
}

/**
 * Header layout for drawer content.
 */
export function DrawerHeader({ className, ...props }: ComponentProps<"div">) {
    return <div className={clsx(drawerHeaderStyle, className)} {...props} />;
}

/**
 * Footer layout for drawer content.
 */
export function DrawerFooter({ className, ...props }: ComponentProps<"div">) {
    return <div className={clsx(drawerFooterStyle, className)} {...props} />;
}
