"use client";

import { prefixDrawerCss } from "@module/utils/prefixDrawerCss";
import {
    type ComponentProps,
    type ComponentPropsWithoutRef,
    type ElementRef,
    type HTMLAttributes,
    forwardRef,
} from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import styles from "./index.module.css";

const Drawer = ({
    shouldScaleBackground = true,
    ...props
}: ComponentProps<typeof DrawerPrimitive.Root>) => (
    <DrawerPrimitive.Root
        shouldScaleBackground={shouldScaleBackground}
        {...props}
    />
);
Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

// const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = forwardRef<
    ElementRef<typeof DrawerPrimitive.Overlay>,
    ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DrawerPrimitive.Overlay
        ref={ref}
        className={`${prefixDrawerCss("overlay")} ${styles.drawer__overlay} ${className}`}
        {...props}
    />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = forwardRef<
    ElementRef<typeof DrawerPrimitive.Content>,
    ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => (
    <DrawerPortal>
        <DrawerOverlay />
        <DrawerPrimitive.Content
            ref={ref}
            className={`${prefixDrawerCss("content")} ${styles.drawer__contentWrapper} ${className}`}
            {...props}
        >
            <div
                className={`${prefixDrawerCss("handle")} ${styles.drawer__handle}`}
            />
            <div className={styles.drawer__content}>{children}</div>
        </DrawerPrimitive.Content>
    </DrawerPortal>
));
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({
    className,
    ...props
}: HTMLAttributes<HTMLDivElement>) => (
    <div className={`${styles.drawer__header} ${className}`} {...props} />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({
    className,
    ...props
}: HTMLAttributes<HTMLDivElement>) => (
    <div className={`${styles.drawer__footer} ${className}`} {...props} />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = forwardRef<
    ElementRef<typeof DrawerPrimitive.Title>,
    ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DrawerPrimitive.Title
        ref={ref}
        className={`${styles.drawer__title} ${className}`}
        {...props}
    />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = forwardRef<
    ElementRef<typeof DrawerPrimitive.Description>,
    ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DrawerPrimitive.Description
        ref={ref}
        className={`${styles.drawer__description} ${className}`}
        {...props}
    />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export { Drawer, DrawerTrigger, DrawerContent };
