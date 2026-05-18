import { globalStyle, style } from "@vanilla-extract/css";

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
