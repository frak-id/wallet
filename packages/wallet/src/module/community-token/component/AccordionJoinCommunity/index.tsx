import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/module/common/component/Accordion";
import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

export function AccordionJoinCommunity({
    trigger,
    children,
}: PropsWithChildren<{ trigger: ReactNode }>) {
    return (
        <Accordion
            type={"single"}
            collapsible
            className={styles.accordionJoinCommunity}
        >
            <AccordionItem value={"item-1"}>
                <AccordionTrigger
                    className={styles.accordionJoinCommunity__trigger}
                >
                    {trigger}
                </AccordionTrigger>
                <AccordionContent
                    className={styles.accordionJoinCommunity__content}
                >
                    {children}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}
