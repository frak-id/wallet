import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@frak-labs/ui/component/Accordion";
import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

export function AccordionLogin({
    trigger,
    children,
}: PropsWithChildren<{ trigger: ReactNode }>) {
    return (
        <Accordion type={"single"} collapsible>
            <AccordionItem value={"item-1"}>
                <AccordionTrigger className={styles.accordionLogin__trigger}>
                    {trigger}
                </AccordionTrigger>
                <AccordionContent className={styles.accordionLogin__content}>
                    {children}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}
