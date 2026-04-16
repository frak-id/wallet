import type { ComponentPropsWithoutRef } from "react";
import { button } from "./index.css";

type ButtonProps = ComponentPropsWithoutRef<"button">;

export function Button({
    className,
    type = "button",
    children,
    ...props
}: ButtonProps) {
    return (
        <button
            {...props}
            type={type}
            className={className ? `${button} ${className}` : button}
        >
            {children}
        </button>
    );
}
