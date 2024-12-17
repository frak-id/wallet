import { Root, Thumb } from "@radix-ui/react-switch";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ComponentRef } from "react";
import styles from "./index.module.css";

export const Switch = forwardRef<
    ComponentRef<typeof Root>,
    ComponentPropsWithoutRef<typeof Root>
>(({ className, ...props }, ref) => (
    <Root className={`${styles.switch} ${className}`} {...props} ref={ref}>
        <Thumb className={styles.switchThumb} />
    </Root>
));
Switch.displayName = Root.displayName;
