import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/module/common/component/Accordion";
import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

export function AccordionInformation({
    trigger,
    children,
}: PropsWithChildren<{ trigger: ReactNode }>) {
    return (
        <Accordion type={"single"} collapsible>
            <AccordionItem value={"item-1"}>
                <AccordionTrigger
                    className={styles.accordionInformation__trigger}
                >
                    {trigger}
                </AccordionTrigger>
                <AccordionContent
                    classNameText={styles.accordionInformation__content}
                >
                    {children}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}
