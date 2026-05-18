import type { ReactNode } from "react";
import { previewWrapper, previewWrapperLabel } from "./preview-wrapper.css";

export function PreviewWrapper({
    label = "Preview",
    children,
}: {
    label?: string;
    children: ReactNode;
}) {
    return (
        <div className={previewWrapper}>
            <p className={previewWrapperLabel}>{label}</p>
            {children}
        </div>
    );
}
