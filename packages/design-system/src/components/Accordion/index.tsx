import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithRef } from "react";
import { accordionStyles } from "./accordion.css";

const Accordion = AccordionPrimitive.Root;

function AccordionItem({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<typeof AccordionPrimitive.Item>) {
    return (
        <AccordionPrimitive.Item
            ref={ref}
            className={
                className
                    ? `${accordionStyles.item} ${className}`
                    : accordionStyles.item
            }
            {...props}
        />
    );
}

function AccordionTrigger({
    ref,
    className,
    children,
    ...props
}: ComponentPropsWithRef<typeof AccordionPrimitive.Trigger>) {
    return (
        <AccordionPrimitive.Header className={accordionStyles.header} asChild>
            <h2>
                <AccordionPrimitive.Trigger
                    ref={ref}
                    className={
                        className
                            ? `${accordionStyles.trigger} ${className}`
                            : accordionStyles.trigger
                    }
                    {...props}
                >
                    {children}
                    <ChevronDown
                        size={16}
                        className={accordionStyles.chevron}
                    />
                </AccordionPrimitive.Trigger>
            </h2>
        </AccordionPrimitive.Header>
    );
}

function AccordionContent({
    ref,
    className,
    children,
    ...props
}: ComponentPropsWithRef<typeof AccordionPrimitive.Content>) {
    return (
        <AccordionPrimitive.Content
            ref={ref}
            className={
                className
                    ? `${accordionStyles.content} ${className}`
                    : accordionStyles.content
            }
            {...props}
        >
            {children}
        </AccordionPrimitive.Content>
    );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
