import { Box } from "@frak-labs/design-system/components/Box";
import { Stack } from "@frak-labs/design-system/components/Stack";
import type { ReactNode } from "react";
import { ContentBlock } from "@/module/common/component/ContentBlock";
import * as styles from "./index.css";

type StepLayoutProps = {
    icon: ReactNode;
    title: ReactNode;
    description: ReactNode;
    footer: ReactNode;
    children?: ReactNode;
};

/**
 * Full-page layout with safe-area insets, centered content, and bottom-pinned footer.
 *
 * Uses ContentBlock for the icon + title + description pattern.
 */
export function StepLayout({
    icon,
    title,
    description,
    footer,
    children,
}: StepLayoutProps) {
    return (
        <Box className={styles.stepLayout}>
            <Stack space="l" align="center" as="div">
                <Box className={styles.stepLayoutContent}>
                    <ContentBlock
                        icon={icon}
                        titleAs="h1"
                        title={title}
                        description={description}
                    >
                        {children}
                    </ContentBlock>
                </Box>
            </Stack>
            <Box className={styles.stepLayoutFooter}>{footer}</Box>
        </Box>
    );
}
