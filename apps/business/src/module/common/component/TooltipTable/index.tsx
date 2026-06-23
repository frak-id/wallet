import { type ReactNode, useState } from "react";
import { tooltipTable } from "./tooltip-table.css";

export function TooltipTable({
    content,
    className = "",
    children,
    ...props
}: {
    content: string | ReactNode;
    className?: string;
    children: ReactNode;
}) {
    const [showTooltip, setShowTooltip] = useState(false);
    return (
        <>
            {showTooltip && (
                <span
                    className={tooltipTable}
                    {...props}
                    onMouseLeave={() => setShowTooltip(false)}
                >
                    {content}
                </span>
            )}
            <span onMouseOver={() => setShowTooltip(true)} onFocus={() => {}}>
                {children}
            </span>
        </>
    );
}
