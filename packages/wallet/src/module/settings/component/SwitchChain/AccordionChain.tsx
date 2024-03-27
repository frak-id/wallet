import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/module/common/component/Accordion";
import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

export function AccordionChain({
    trigger,
    children,
}: PropsWithChildren<{ trigger: ReactNode }>) {
    return (
        <Accordion
            type={"single"}
            collapsible
            className={styles.accordionChainSwitch}
        >
            <AccordionItem value={"item-1"}>
                <AccordionTrigger
                    className={styles.accordionChainSwitch__trigger}
                >
                    {trigger}
                </AccordionTrigger>
                <AccordionContent>{children}</AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}
