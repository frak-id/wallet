import { globalStyle, style } from "@vanilla-extract/css";

// Referenced as `styles.purchaseTrackerSetup` in PurchaseTracker.tsx but not
// defined in the original CSS module — preserve the export to keep the
// className prop typed.
export const purchaseTrackerSetup = style({});

export const purchaseTrackerAccordionContent = style({});

globalStyle(
    `${purchaseTrackerAccordionContent} p, ${purchaseTrackerAccordionContent} form, ${purchaseTrackerAccordionContent} button`,
    {
        marginTop: "10px",
    }
);

export const purchaseTrackerDescription = style({
    margin: "0 0 10px 0",
    fontSize: "16px",
});
