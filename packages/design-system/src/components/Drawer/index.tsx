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

export const DrawerTrigger = DrawerPrimitive.Trigger;

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
    /** Drops the built-in handle — the consumer must then render its own `<DrawerTitle>` for a11y. */
    hideHandle?: boolean;
    contentClassName?: string;
    /** Drops the side + bottom margins so the sheet sits flush against the screen edges. */
    edgeToEdge?: boolean;
    /** `muted` swaps the elevated white content bg for a grey surface. */
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

export const DrawerTitle = DrawerPrimitive.Title;

export const DrawerDescription = DrawerPrimitive.Description;

export function DrawerHeader({ className, ...props }: ComponentProps<"div">) {
    return <div className={clsx(drawerHeaderStyle, className)} {...props} />;
}

export function DrawerFooter({ className, ...props }: ComponentProps<"div">) {
    return <div className={clsx(drawerFooterStyle, className)} {...props} />;
}
