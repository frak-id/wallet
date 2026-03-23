import { Root, Thumb } from "@radix-ui/react-switch";
import clsx from "clsx";
import type { ComponentPropsWithRef } from "react";
import { switchRoot, switchThumb } from "./switch.css";

type SwitchProps = ComponentPropsWithRef<typeof Root> & {
    className?: string;
};

export function Switch({ ref, className, ...props }: SwitchProps) {
    const combinedClassName = clsx(switchRoot, className);

    return (
        <Root className={combinedClassName} ref={ref} {...props}>
            <Thumb className={switchThumb} />
        </Root>
    );
}
