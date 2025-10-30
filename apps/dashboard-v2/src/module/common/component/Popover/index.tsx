import { Content, Portal, Root, Trigger } from "@radix-ui/react-popover";
import type { ComponentPropsWithRef } from "react";
import styles from "./index.module.css";

const Popover = Root;

const PopoverTrigger = Trigger;

const PopoverContent = ({
    ref,
    className,
    align = "center",
    sideOffset = 4,
    ...props
}: ComponentPropsWithRef<typeof Content>) => (
    <Portal>
        <Content
            ref={ref}
            className={`${styles.popover} ${className}`}
            align={align}
            sideOffset={sideOffset}
            {...props}
        />
    </Portal>
);
PopoverContent.displayName = Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
