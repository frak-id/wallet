import { Root } from "@radix-ui/react-separator";
import type { ComponentPropsWithRef } from "react";
import styles from "./index.module.css";

export const Separator = ({
    ref,
    className,
    orientation = "horizontal",
    decorative = true,
    ...props
}: ComponentPropsWithRef<typeof Root>) => (
    <Root
        ref={ref}
        decorative={decorative}
        orientation={orientation}
        className={`${styles.separator} ${className}`}
        {...props}
    />
);
Separator.displayName = Root.displayName;
