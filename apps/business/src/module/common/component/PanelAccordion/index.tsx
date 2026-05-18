import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@frak-labs/design-system/components/Accordion";
import type { RecipeVariants } from "@vanilla-extract/recipes";
import type { ComponentPropsWithRef } from "react";
import {
    Panel,
    PanelTitle,
    type panelVariants,
} from "@/module/common/component/Panel";
import {
    panelAccordionContent,
    panelAccordionItem,
    panelAccordionTrigger,
} from "./panel-accordion.css";

type PanelRecipeVariants = NonNullable<RecipeVariants<typeof panelVariants>>;

export type PanelProps = ComponentPropsWithRef<typeof Panel> &
    PanelRecipeVariants & {
        title?: string;
        withBadge?: boolean;
        className?: string;
        value?: string;
        defaultValue?: string;
        onValueChange?: (value: string) => void;
    };

export const PanelAccordion = ({
    ref,
    children,
    title,
    value,
    defaultValue,
    onValueChange,
    ...props
}: PanelProps) => {
    return (
        <Panel ref={ref} {...props}>
            <Accordion
                type={"single"}
                collapsible
                value={value}
                defaultValue={defaultValue}
                onValueChange={onValueChange}
            >
                <AccordionItem value={"item-1"} className={panelAccordionItem}>
                    <AccordionTrigger className={panelAccordionTrigger}>
                        <PanelTitle title={title} />
                    </AccordionTrigger>
                    <AccordionContent className={panelAccordionContent}>
                        {children}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </Panel>
    );
};
