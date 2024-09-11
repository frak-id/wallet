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
} from "@module/component/Accordion";
import type { VariantProps } from "class-variance-authority";
import { type HTMLAttributes, type PropsWithChildren, forwardRef } from "react";
import styles from "./index.module.css";

export interface PanelProps
    extends HTMLAttributes<HTMLDivElement>,
        PropsWithChildren<VariantProps<typeof panelVariants>> {
    title?: string;
    withBadge?: boolean;
    className?: string;
}

export const PanelAccordion = forwardRef<HTMLDivElement, PanelProps>(
    ({ children, title, ...props }, ref) => {
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
    }
);
