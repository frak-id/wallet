"use client";

import { Content, Portal, Root, Trigger } from "@radix-ui/react-popover";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ComponentRef } from "react";
import styles from "./index.module.css";

const Popover = Root;

const PopoverTrigger = Trigger;

const PopoverContent = forwardRef<
    ComponentRef<typeof Content>,
    ComponentPropsWithoutRef<typeof Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
    <Portal>
        <Content
            ref={ref}
            className={`${styles.popover} ${className}`}
            align={align}
            sideOffset={sideOffset}
            {...props}
        />
    </Portal>
));
PopoverContent.displayName = Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
