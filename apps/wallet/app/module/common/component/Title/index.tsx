import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import * as styles from "./index.css";

type TitleProps = {
    icon?: ReactNode;
    className?: string;
    classNameText?: string;
    children?: ReactNode;
    size?: "page" | "medium";
};

export function Title({
    icon,
    className = "",
    classNameText = "",
    size = "medium",
    children,
}: TitleProps) {
    const tag = size === "page" ? "h1" : "h2";

    return (
        <Box
            as={tag}
            className={[styles.title({ size }), className]
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
