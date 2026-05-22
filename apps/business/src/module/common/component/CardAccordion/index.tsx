import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@frak-labs/design-system/components/Accordion";
import { Card, CardTitle } from "@frak-labs/design-system/components/Card";
import type { ComponentProps, ReactNode } from "react";
import {
    cardAccordionContent,
    cardAccordionItem,
    cardAccordionTrigger,
} from "./card-accordion.css";

export type CardAccordionProps = Omit<ComponentProps<typeof Card>, "title"> & {
    title?: string;
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    children?: ReactNode;
};

export const CardAccordion = ({
    children,
    title,
    value,
    defaultValue,
    onValueChange,
    ...props
}: CardAccordionProps) => {
    return (
        <Card {...props}>
            <Accordion
                type={"single"}
                collapsible
                value={value}
                defaultValue={defaultValue}
                onValueChange={onValueChange}
            >
                <AccordionItem value={"item-1"} className={cardAccordionItem}>
                    <AccordionTrigger className={cardAccordionTrigger}>
                        {title && <CardTitle>{title}</CardTitle>}
                    </AccordionTrigger>
                    <AccordionContent className={cardAccordionContent}>
                        {children}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </Card>
    );
};
