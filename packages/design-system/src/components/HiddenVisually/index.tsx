import clsx from "clsx";
import type { ReactNode } from "react";
import { visuallyHidden } from "../../reset.css";

export type HiddenVisuallyProps = {
    children?: ReactNode;
    id?: string;
    className?: string;
};

export function HiddenVisually({
    children,
    id,
    className,
}: HiddenVisuallyProps) {
    return (
        <span id={id} className={clsx(visuallyHidden, className)}>
            {children}
        </span>
    );
}
