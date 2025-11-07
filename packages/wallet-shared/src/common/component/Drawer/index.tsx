import { prefixDrawerCss } from "@frak-labs/ui/utils/prefixDrawerCss";
import type { ComponentProps, ComponentPropsWithRef } from "react";
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

const DrawerOverlay = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof DrawerPrimitive.Overlay>) => (
    <DrawerPrimitive.Overlay
        ref={ref}
        className={`${prefixDrawerCss("overlay")} ${styles.drawer__overlay} ${className}`}
        {...props}
    />
);
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = ({
    ref,
    className,
    children,
    ...props
}: ComponentPropsWithRef<typeof DrawerPrimitive.Content>) => (
    <DrawerPortal>
        <DrawerOverlay />
        <DrawerPrimitive.Content
            ref={ref}
            className={`${prefixDrawerCss("content")} ${styles.drawer__contentWrapper} ${className}`}
            {...props}
        >
            <DrawerPrimitive.Title asChild>
                <div
                    className={`${prefixDrawerCss("handle")} ${styles.drawer__handle}`}
                />
            </DrawerPrimitive.Title>
            <DrawerPrimitive.Description asChild>
                <div className={styles.drawer__content}>{children}</div>
            </DrawerPrimitive.Description>
        </DrawerPrimitive.Content>
    </DrawerPortal>
);
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({ className, ...props }: ComponentProps<"div">) => (
    <div className={`${styles.drawer__header} ${className}`} {...props} />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({ className, ...props }: ComponentProps<"div">) => (
    <div className={`${styles.drawer__footer} ${className}`} {...props} />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof DrawerPrimitive.Title>) => (
    <DrawerPrimitive.Title ref={ref} className={`${className}`} {...props} />
);
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof DrawerPrimitive.Description>) => (
    <DrawerPrimitive.Description
        ref={ref}
        className={`${className}`}
        {...props}
    />
);
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export { Drawer, DrawerTrigger, DrawerContent };
