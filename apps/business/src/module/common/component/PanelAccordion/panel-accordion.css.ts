import { globalStyle, style } from "@vanilla-extract/css";

export const panelAccordionItem = style({
    // DS AccordionItem ships a border-bottom for vertically stacked items.
    // PanelAccordion always renders a single item inside a Panel surface,
    // so the divider is purely decorative — drop it.
    borderBottom: "none",
});

export const panelAccordionTrigger = style({
    display: "flex",
    alignItems: "center",
    gap: "10px",
});

globalStyle(`${panelAccordionTrigger} > h2`, {
    marginBottom: 0,
});

export const panelAccordionContent = style({
    marginTop: "14px",
});
