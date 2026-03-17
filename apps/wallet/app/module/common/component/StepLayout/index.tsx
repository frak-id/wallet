import { Box } from "@frak-labs/ui/component/Box";
import type { ReactNode } from "react";
import { ContentBlock } from "@/module/common/component/ContentBlock";
import styles from "./index.module.css";

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
        <div className={styles.stepLayout}>
            <Box gap="l" padding="none" className={styles.stepLayout__content}>
                <ContentBlock
                    icon={icon}
                    titleAs="h1"
                    title={title}
                    description={description}
                >
                    {children}
                </ContentBlock>
            </Box>
            <div className={styles.stepLayout__footer}>{footer}</div>
        </div>
    );
}
