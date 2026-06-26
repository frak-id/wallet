import type { ReactNode } from "react";
import { Box } from "../Box";

type ValidContentBlockElement =
    | "div"
    | "section"
    | "main"
    | "article"
    | "aside";

export type ContentBlockProps = {
    children?: ReactNode;
    maxWidth: string;
    align?: "left" | "center";
    as?: ValidContentBlockElement;
    /**
     * Extra classes. Note: ContentBlock owns `width`, `max-width` and
     * `margin-inline` via inline style — a className setting those will be
     * overridden.
     */
    className?: string;
};

export function ContentBlock({
    children,
    maxWidth,
    align = "center",
    as = "div",
    className,
}: ContentBlockProps) {
    return (
        <Box
            as={as}
            className={className}
            style={{
                width: "100%",
                maxWidth,
                ...(align === "center" ? { marginInline: "auto" } : {}),
            }}
        >
            {children}
        </Box>
    );
}
