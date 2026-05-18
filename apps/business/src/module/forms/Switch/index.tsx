import { Root, Thumb } from "@radix-ui/react-switch";
import clsx from "clsx";
import type { ComponentPropsWithRef } from "react";
import { switchRoot, switchThumb } from "./switch.css";

export const Switch = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof Root>) => (
    <Root className={clsx(switchRoot, className)} {...props} ref={ref}>
        <Thumb className={switchThumb} />
    </Root>
);
Switch.displayName = Root.displayName;
