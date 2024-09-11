"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import {
    type ComponentPropsWithoutRef,
    type ElementRef,
    forwardRef,
} from "react";
import styles from "./index.module.css";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = forwardRef<
    ElementRef<typeof AccordionPrimitive.Item>,
    ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className = "", ...props }, ref) => (
    <AccordionPrimitive.Item
        ref={ref}
        className={`${styles.accordion__item} ${className}`}
        {...props}
    />
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = forwardRef<
    ElementRef<typeof AccordionPrimitive.Trigger>,
    ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className = "", children, ...props }, ref) => (
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
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = forwardRef<
    ElementRef<typeof AccordionPrimitive.Content>,
    ComponentPropsWithoutRef<typeof AccordionPrimitive.Content> & {
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
