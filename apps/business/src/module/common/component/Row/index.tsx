import type { PropsWithChildren } from "react";
import { row } from "./row.css";

type RowProps = {
    align?: "start" | "center" | "end";
    className?: string;
};

export function Row({
    align = "end",
    className = "",
    children,
}: PropsWithChildren<RowProps>) {
    return (
        <div className={`${row({ align })}${className ? ` ${className}` : ""}`}>
            {children}
        </div>
    );
}
