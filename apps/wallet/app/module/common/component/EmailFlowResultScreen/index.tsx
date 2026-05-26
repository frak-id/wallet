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
     * Optional content rendered centered on the header row next to the back
     * button. Used by the merge flow to drop a "Step N/M" indicator without
     * each result screen having to know about the stepper.
     */
    headerCenter?: ReactNode;
    /**
     * Action buttons stacked at the bottom of the screen (primary CTA on
     * top, secondary below). Rendered into `PageLayout`'s footer slot so
     * they sit above the home indicator instead of floating right under
     * the description — keeps the visual contract consistent with the rest
     * of the wallet's page-style screens.
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
    headerCenter,
    children,
}: EmailFlowResultScreenProps) {
    return (
        <PageLayout
            fixedViewport
            back={onBack ? <Back onClick={onBack} /> : undefined}
            headerCenter={headerCenter}
            footer={
                children ? (
                    <Box className={styles.actions}>{children}</Box>
                ) : undefined
            }
        >
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">{title}</Title>
                    <Text variant="body" color="secondary">
                        {description}
                    </Text>
                </Stack>
            </Stack>
        </PageLayout>
    );
}
