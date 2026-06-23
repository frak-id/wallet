import { Root } from "@radix-ui/react-separator";
import clsx from "clsx";
import type { ComponentPropsWithRef } from "react";
import { separator } from "./separator.css";

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
        className={clsx(separator, className)}
        {...props}
    />
);
Separator.displayName = Root.displayName;
