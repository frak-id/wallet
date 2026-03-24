import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import * as styles from "./index.css";

type ContentBlockProps = {
    icon: ReactNode;
    title: ReactNode;
    description: ReactNode;
    footer?: ReactNode;
    children?: ReactNode;
    /** Heading level for the title element (default: "h2") */
    titleAs?: "h1" | "h2" | "h3";
};

/**
 * Shared centered content pattern: icon circle + title + description + optional footer.
 *
 * Renders as a Fragment — wrap in a layout component (Box, StepLayout, etc.) for spacing.
 */
export function ContentBlock({
    icon,
    title,
    description,
    footer,
    children,
    titleAs: TitleTag = "h2",
}: ContentBlockProps) {
    return (
        <>
            <Box className={styles.content}>
                <Box className={styles.icon}>{icon}</Box>
                <Text as={TitleTag} className={styles.title}>
                    {title}
                </Text>
                <Text as="p" className={styles.description}>
                    {description}
                </Text>
                {children}
            </Box>
            {footer && <Box className={styles.footer}>{footer}</Box>}
        </>
    );
}
