import { Box } from "@frak-labs/design-system/components/Box";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import { Back } from "@/module/common/component/Back";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import * as styles from "./index.css";

export type EmailFlowResultScreenProps = {
    title: string;
    description: ReactNode;
    onBack?: () => void;
    /**
     * Action buttons stacked at the bottom of the content (primary CTA on top,
     * secondary below). The parent decides which buttons make sense per state
     * (login, retry, set up recovery, back to profile, etc.).
     */
    children?: ReactNode;
};

/**
 * Result screen for an email flow that has reached a terminal-ish state:
 * success after add-email, conflict on add-email, already-used during
 * registration. Replaces the per-flow inline banners with a dedicated page
 * the user can navigate back from.
 */
export function EmailFlowResultScreen({
    title,
    description,
    onBack,
    children,
}: EmailFlowResultScreenProps) {
    return (
        <PageLayout
            fixedViewport
            back={onBack ? <Back onClick={onBack} /> : undefined}
        >
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">{title}</Title>
                    <Text variant="body" color="secondary">
                        {description}
                    </Text>
                </Stack>
                {children && <Box className={styles.actions}>{children}</Box>}
            </Stack>
        </PageLayout>
    );
}
