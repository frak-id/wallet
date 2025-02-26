import {
    Panel,
    PanelTitle,
    type panelVariants,
} from "@/module/common/component/Panel";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@shared/module/component/Accordion";
import type { VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import styles from "./index.module.css";

export type PanelProps = ComponentPropsWithRef<typeof Panel> &
    VariantProps<typeof panelVariants> & {
        title?: string;
        withBadge?: boolean;
        className?: string;
    };

export const PanelAccordion = ({
    ref,
    children,
    title,
    ...props
}: PanelProps) => {
    return (
        <Panel ref={ref} {...props}>
            <Accordion type={"single"} collapsible>
                <AccordionItem value={"item-1"}>
                    <AccordionTrigger
                        className={styles.panelAccordion__trigger}
                    >
                        <PanelTitle title={title} />
                    </AccordionTrigger>
                    <AccordionContent
                        className={styles.panelAccordion__content}
                    >
                        {children}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </Panel>
    );
};
