import { globalStyle, style } from "@vanilla-extract/css";

export const cardAccordionItem = style({
    // DS AccordionItem ships a border-bottom for vertically stacked items.
    // CardAccordion always renders a single item inside a Card surface, so
    // the divider is purely decorative — drop it.
    borderBottom: "none",
});

export const cardAccordionTrigger = style({
    display: "flex",
    alignItems: "center",
    gap: "10px",
});

globalStyle(`${cardAccordionTrigger} > h3`, {
    marginBottom: 0,
});

export const cardAccordionContent = style({
    marginTop: "14px",
});
