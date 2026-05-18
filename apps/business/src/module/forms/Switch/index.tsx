import { Root, Thumb } from "@radix-ui/react-switch";
import type { ComponentPropsWithRef } from "react";
import { switchRoot, switchThumb } from "./switch.css";

export const Switch = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof Root>) => (
    <Root
        className={`${switchRoot}${className ? ` ${className}` : ""}`}
        {...props}
        ref={ref}
    >
        <Thumb className={switchThumb} />
    </Root>
);
Switch.displayName = Root.displayName;
