import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithRef } from "react";
import styles from "./index.module.css";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = ({
    ref,
    className = "",
    ...props
}: ComponentPropsWithRef<typeof AccordionPrimitive.Item>) => (
    <AccordionPrimitive.Item
        ref={ref}
        className={`${styles.accordion__item} ${className}`}
        {...props}
    />
);
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = ({
    ref,
    className = "",
    children,
    ...props
}: ComponentPropsWithRef<typeof AccordionPrimitive.Trigger>) => (
    <AccordionPrimitive.Header className={styles.accordion__header} asChild>
        <h2>
            <AccordionPrimitive.Trigger
                ref={ref}
                className={`${styles.accordion__trigger} ${className}`}
                {...props}
            >
                {children}
                <ChevronDown size={16} className={styles.accordion__chevron} />
            </AccordionPrimitive.Trigger>
        </h2>
    </AccordionPrimitive.Header>
);
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = ({
    ref,
    className = "",
    classNameText = "",
    children,
    ...props
}: ComponentPropsWithRef<typeof AccordionPrimitive.Content> & {
    classNameText?: string;
}) => (
    <AccordionPrimitive.Content
        ref={ref}
        className={`${styles.accordion__content} ${className}`}
        {...props}
    >
        <div className={`${classNameText}`}>{children}</div>
    </AccordionPrimitive.Content>
);
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
