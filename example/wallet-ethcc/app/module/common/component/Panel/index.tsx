import type { PropsWithChildren } from "react";
import { panel } from "./index.css";

type PanelProps = {
    className?: string;
};

export function Panel({
    className = "",
    children,
}: PropsWithChildren<PanelProps>) {
    return (
        <section className={`${panel} ${className}`.trim()}>{children}</section>
    );
}
