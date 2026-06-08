import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import {
    Stepper,
    type StepperStep,
} from "@frak-labs/design-system/components/Stepper";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import * as styles from "./campaignWizardLayout.css";

/**
 * Fallback rail labels. The live wizard passes localised `steps` derived from
 * `wizardSteps.ts`; this English list is only used if `steps` is omitted.
 */
export const CAMPAIGN_STEPS: StepperStep[] = [
    { title: "Campaign basics", description: "Name, merchant & currency" },
    { title: "Goals", description: "What action triggers rewards" },
    {
        title: "Territory & categories",
        description: "Countries & Ad categories",
    },
    { title: "Budget & schedule", description: "Amount, period & dates" },
    { title: "Reward setup", description: "Model, value & distribution" },
    { title: "Campaign validation", description: "Review & publish" },
];

type CampaignWizardLayoutProps = {
    /** Resolved stepper steps (title + description). Defaults to CAMPAIGN_STEPS. */
    steps?: StepperStep[];
    /** Index of the active step (0-based). */
    activeStep: number;
    /** Optional handler to navigate between steps (clickable completed steps). */
    onStepClick?: (index: number) => void;
    /** Page title shown in the header. */
    title: string;
    /** Optional sub-title shown beneath the title. */
    description?: string;
    /** Top-left control (e.g. the Back arrow). Hidden on the first step. */
    headerLeading?: ReactNode;
    /** Header right-aligned actions (e.g. save draft, close). */
    headerActions?: ReactNode;
    /** Sticky bottom bar content (e.g. the Continue button). */
    footer?: ReactNode;
    children: ReactNode;
};

export function CampaignWizardLayout({
    steps = CAMPAIGN_STEPS,
    activeStep,
    onStepClick,
    title,
    description,
    headerLeading,
    headerActions,
    footer,
    children,
}: CampaignWizardLayoutProps) {
    return (
        <div className={styles.root}>
            <aside className={styles.rail}>
                <Stepper
                    steps={steps}
                    activeStep={activeStep}
                    onStepClick={onStepClick}
                />
            </aside>
            <div className={styles.main}>
                <Stack space="m" className={styles.header}>
                    {/* Controls row: Back (left) + Save/Close (right). */}
                    <Inline
                        space="m"
                        align="space-between"
                        alignY="center"
                        wrap={false}
                    >
                        <div>{headerLeading}</div>
                        {headerActions && (
                            <Inline space="s" alignY="center" wrap={false}>
                                {headerActions}
                            </Inline>
                        )}
                    </Inline>
                    {/* Title block. */}
                    <Stack space="xs">
                        <Text as="h1" variant="heading1">
                            {title}
                        </Text>
                        {description && (
                            <Text variant="body" color="secondary">
                                {description}
                            </Text>
                        )}
                    </Stack>
                </Stack>
                <div className={styles.content}>{children}</div>
                {footer && <div className={styles.footer}>{footer}</div>}
            </div>
        </div>
    );
}
