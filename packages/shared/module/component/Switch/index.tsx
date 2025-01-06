import { Root, Thumb } from "@radix-ui/react-switch";
import type { ComponentPropsWithRef } from "react";
import styles from "./index.module.css";

export const Switch = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof Root>) => (
    <Root className={`${styles.switch} ${className}`} {...props} ref={ref}>
        <Thumb className={styles.switchThumb} />
    </Root>
);
Switch.displayName = Root.displayName;
