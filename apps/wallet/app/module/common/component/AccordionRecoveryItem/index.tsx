import { Panel } from "@/module/common/component/Panel";
import { recoveryStepAtom } from "@/module/settings/atoms/recovery";
import {
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@frak-labs/ui/component/Accordion";
import { useAtomValue } from "jotai";
import { BadgeCheck } from "lucide-react";
import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

export function AccordionRecoveryItem({
    actualStep,
    title,
    children,
}: PropsWithChildren<{
    actualStep: number;
    title: string;
}>) {
    const currentStep = useAtomValue(recoveryStepAtom);
    const status = getStatusCurrentStep(actualStep, currentStep);
    return (
        <Panel>
            <AccordionItem
                value={`step-${actualStep}`}
                disabled={status === "done" || status === "pending"}
            >
                <AccordionTrigger
                    className={styles.accordionRecoveryItem__trigger}
                >
                    {status === "done" && <BadgeCheck color={"white"} />}
                    <span>
                        {actualStep}. {title}
                    </span>
                </AccordionTrigger>
                <AccordionContent
                    className={styles.accordionRecoveryItem__content}
                >
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
