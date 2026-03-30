import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import * as styles from "./index.css";

export interface TitleProps {
    icon?: ReactNode;
    className?: string;
    classNameText?: string;
    children?: string | ReactNode;
    size?: "page" | "medium" | "big";
    align?: "left" | "center";
}

export function Title({
    icon,
    className = "",
    classNameText = "",
    size = "medium",
    align = "left",
    children,
}: TitleProps) {
    const tag = size === "page" ? "h1" : "h2";

    return (
        <Box
            as={tag}
            className={[
                styles.title,
                styles.size[size],
                styles.align[align],
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {icon && <Box as="span">{icon}</Box>}
            {size === "page" ? (
                children
            ) : (
                <Text
                    as="span"
                    className={[styles.titleText, classNameText]
                        .filter(Boolean)
                        .join(" ")}
                >
                    {children}
                </Text>
            )}
        </Box>
    );
}
