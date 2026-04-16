import type { ComponentPropsWithoutRef } from "react";
import { spinner } from "./index.css";

type SpinnerProps = ComponentPropsWithoutRef<"span">;

export function Spinner({ className, ...props }: SpinnerProps) {
    return (
        <span
            {...props}
            className={className ? `${spinner} ${className}` : spinner}
            role="status"
            aria-label="Loading"
        />
    );
}
