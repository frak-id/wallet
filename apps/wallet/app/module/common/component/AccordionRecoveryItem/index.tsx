import {
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@frak-labs/design-system/components/Accordion";
import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { BadgeCheck } from "lucide-react";
import type { PropsWithChildren } from "react";
import { Panel } from "@/module/common/component/Panel";
import {
    recoveryStore,
    selectRecoveryStep,
} from "@/module/stores/recoveryStore";
import * as styles from "./index.css";

export function AccordionRecoveryItem({
    actualStep,
    title,
    children,
}: PropsWithChildren<{
    actualStep: number;
    title: string;
}>) {
    const currentStep = recoveryStore(selectRecoveryStep);
    const status = getStatusCurrentStep(actualStep, currentStep);
    return (
        <Panel>
            <AccordionItem
                value={`step-${actualStep}`}
                disabled={status === "done" || status === "pending"}
            >
                <AccordionTrigger className={styles.trigger}>
                    <Box className={styles.triggerContent}>
                        {status === "done" && (
                            <BadgeCheck className={styles.triggerIcon} />
                        )}
                        <Text as="span" className={styles.triggerLabel}>
                            {actualStep}. {title}
                        </Text>
                    </Box>
                </AccordionTrigger>
                <AccordionContent className={styles.content}>
                    {children}
                </AccordionContent>
            </AccordionItem>
        </Panel>
    );
}

function getStatusCurrentStep(step: number, currentStep: number) {
    if (step === currentStep) {
        return "in-progress";
    }
    if (step < currentStep) {
        return "done";
    }
    return "pending";
}
