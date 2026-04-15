import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@frak-labs/design-system/components/Accordion";
import type { PropsWithChildren, ReactNode } from "react";
import * as styles from "./index.css";

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
