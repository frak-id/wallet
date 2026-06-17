import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import {
    Stepper,
    type StepperStep,
} from "@frak-labs/design-system/components/Stepper";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import * as styles from "./wizardLayout.css";

type WizardLayoutProps = {
    /** Resolved stepper steps (title + description), localised by the caller. */
    steps: StepperStep[];
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

/**
 * Full-screen wizard chrome shared by the campaign and merchant creation flows:
 * a left stepper rail, a header (title + leading/actions), the scrollable
 * content column, and a sticky footer bar centred over the content.
 */
export function WizardLayout({
    steps,
    activeStep,
    onStepClick,
    title,
    description,
    headerLeading,
    headerActions,
    footer,
    children,
}: WizardLayoutProps) {
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
                {footer && (
                    <div className={styles.footer}>
                        <div className={styles.footerInner}>{footer}</div>
                    </div>
                )}
            </div>
        </div>
    );
}
