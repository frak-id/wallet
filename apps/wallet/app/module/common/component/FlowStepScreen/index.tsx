import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import { Back } from "@/module/common/component/Back";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import * as styles from "./index.css";

type FlowStepScreenProps = {
    title: string;
    /** Lead paragraph under the title. Omit for screens that don't need one. */
    description?: ReactNode;
    /** When set, renders a back affordance wired to this handler. */
    onBack?: () => void;
    /** Disable the back affordance (e.g. while a step is mid-flight). */
    backDisabled?: boolean;
    /** Header-center slot, typically a "N/M" step indicator. */
    stepIndicator?: ReactNode;
    /** Bottom-pinned actions (a single `Button`, or a `Stack` of them). */
    footer?: ReactNode;
    fixedViewport?: boolean;
    children?: ReactNode;
};

/**
 * Shared scaffold for an interactive step screen: header (back + step
 * indicator), page title + description, and a pinned footer. Mirrors
 * `EmailFlowResultScreen` (the terminal-screen counterpart) so multi-step
 * flows don't repeat the `PageLayout > Title + description` boilerplate per
 * step.
 */
export function FlowStepScreen({
    title,
    description,
    onBack,
    backDisabled,
    stepIndicator,
    footer,
    fixedViewport,
    children,
}: FlowStepScreenProps) {
    return (
        <PageLayout
            fixedViewport={fixedViewport}
            back={
                onBack ? (
                    <Back onClick={onBack} disabled={backDisabled} />
                ) : undefined
            }
            headerCenter={stepIndicator}
            footer={footer}
        >
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">{title}</Title>
                    {description ? (
                        <Text variant="body" color="secondary">
                            {description}
                        </Text>
                    ) : null}
                </Stack>
                {children}
            </Stack>
        </PageLayout>
    );
}
