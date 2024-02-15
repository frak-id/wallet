import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/module/common/component/Accordion";
import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

export function AccordionArticle({ children }: PropsWithChildren) {
    return (
        <Accordion
            type={"single"}
            collapsible
            className={styles.login__accordion}
        >
            <AccordionItem value={"item-1"}>
                <AccordionTrigger
                    className={styles.accordionArticle__trigger}
                />
                <AccordionContent>{children}</AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}
