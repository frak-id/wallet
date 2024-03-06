"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import * as React from "react";
import styles from "./index.module.css";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
    React.ElementRef<typeof AccordionPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className = "", ...props }, ref) => (
    <AccordionPrimitive.Item
        ref={ref}
        className={`${styles.accordion__item} ${className}`}
        {...props}
    />
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
    React.ElementRef<typeof AccordionPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className = "", children, ...props }, ref) => (
    <AccordionPrimitive.Header className={styles.accordion__header} asChild>
        <h2>
            <AccordionPrimitive.Trigger
                ref={ref}
                className={`${styles.accordion__trigger} ${className}`}
                {...props}
            >
                {children}
                <ChevronDown className={styles.accordion__chevron} />
            </AccordionPrimitive.Trigger>
        </h2>
    </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
    React.ElementRef<typeof AccordionPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content> & {
        classNameText?: string;
    }
>(({ className = "", classNameText = "", children, ...props }, ref) => (
    <AccordionPrimitive.Content
        ref={ref}
        className={`${styles.accordion__content} ${className}`}
        {...props}
    >
        <div className={`${classNameText}`}>{children}</div>
    </AccordionPrimitive.Content>
));
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
