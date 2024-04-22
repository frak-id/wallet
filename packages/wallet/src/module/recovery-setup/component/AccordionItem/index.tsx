import {
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/module/common/component/Accordion";
import { Panel } from "@/module/common/component/Panel";
import { BadgeCheck } from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

export function AccordionRecoveryItem({
    item,
    trigger,
    status = "pending",
    children,
}: PropsWithChildren<{
    item: string;
    trigger: ReactNode;
    status?: "in-progress" | "done" | "pending";
}>) {
    return (
        <Panel>
            <AccordionItem
                value={item}
                disabled={status === "done" || status === "pending"}
            >
                <AccordionTrigger className={styles.accordion__trigger}>
                    {status === "done" && <BadgeCheck color={"white"} />}
                    {trigger}
                </AccordionTrigger>
                <AccordionContent className={styles.accordion__content}>
                    {children}
                </AccordionContent>
            </AccordionItem>
        </Panel>
    );
}
