const FIXED_HEIGHT =
    "the large size has a fixed 48px height and a 100% line-height, so a label that wraps spills above and below the button";
const NO_WRAP =
    "a string with no break opportunity cannot shrink below its width, and nothing here wraps, clips or ellipsizes it";

/**
 * Findings the gallery surfaces in current component code, keyed
 * `<overflow|focus|overlay|pointer>:<section id>:<case name>`; the value is the reason.
 * The spec asserts each still occurs: fix the component and the entry fails
 * until it is deleted, which is the signal that the bug is gone.
 */
export const knownFindings: Record<string, string> = {
    "overflow:text:worst: unbreakable email": `Text: ${NO_WRAP}`,
    "overflow:text:worst: huge number": `Text: ${NO_WRAP}`,
    "overflow:stack:worst: unbreakable email": `Stack passes the Text overflow through: ${NO_WRAP}`,
    "overflow:box:worst: unbreakable email": `Box does not clip: ${NO_WRAP}`,
    "overflow:inline:worst: unbreakable email": `Inline children keep their min-content: ${NO_WRAP}`,
    "overflow:tiles:worst: unbreakable email in 2 columns": `Tiles only stops the track blowing out (minWidth 0): ${NO_WRAP}`,
    "overflow:button:worst: unbreakable email": `Button label: ${NO_WRAP}`,
    "overflow:button:worst: huge number": `Button label: ${NO_WRAP}`,
    "overflow:input:length medium":
        'length="medium" is a fixed 320px, wider than the 288px a 320px viewport leaves after page padding',
    "overflow:input:worst: one-character label, unbreakable hint": `FieldLabel hint: ${NO_WRAP}`,
    "overflow:select:length medium":
        'length="medium" is a fixed 320px, wider than the 288px a 320px viewport leaves after page padding',
    "overflow:select:worst: unbreakable email selected": `SelectValue in the trigger does not truncate: ${NO_WRAP}`,
    "overflow:notice:worst: unbreakable email": `Notice content (minWidth 0) lets the text spill out of the tinted box: ${NO_WRAP}`,
    "overflow:badge:worst: unbreakable email":
        "Badge is nowrap with no truncation",
    "overflow:badge:worst: long sentence": "Badge is nowrap with no truncation",
    "overflow:badge:worst: non-Latin and emoji":
        "Badge is nowrap with no truncation",

    "clip:button:worst: long sentence": `Button: ${FIXED_HEIGHT}`,
    "clip:empty-state:worst: long sentence": `The action is a large Button: ${FIXED_HEIGHT}`,
    "clip:card:worst: unbreakable email": `Card clips its content (overflow: hidden, for the rounded corners): ${NO_WRAP}`,

    "overflow:toast-surface:worst: unbreakable email":
        "ConfirmationTooltip lays its label out with Inline wrap={false}, so the pill never wraps",
    "overflow:toast-surface:worst: long sentence":
        "ConfirmationTooltip lays its label out with Inline wrap={false}, so the pill never wraps",

    "overlay:dialog:worst: unbreakable email": `DialogTitle and DialogDescription: ${NO_WRAP}`,
    "overlay:drawer:worst: unbreakable email": `Drawer content: ${NO_WRAP}`,
    "overflow:spread:worst: unbreakable email": `Spread children keep their min-content: ${NO_WRAP}`,
    "overflow:content-block:worst: unbreakable email": `ContentBlock does not clip: ${NO_WRAP}`,
    "overflow:radio-group:worst: unbreakable email": `radio label: ${NO_WRAP}`,
    "overflow:field-label:worst: unbreakable email": `FieldLabel label and hint: ${NO_WRAP}`,
    "overflow:field-error:worst: unbreakable email": `FieldError message: ${NO_WRAP}`,
    "overflow:empty-state:worst: unbreakable email": `EmptyState title and description: ${NO_WRAP}`,
    "overlay:responsive-modal:worst: unbreakable email": `ResponsiveModal content: ${NO_WRAP}`,
    "overlay:popover:worst: unbreakable email": `PopoverContent: ${NO_WRAP}`,
    "overlay:sheet:worst: unbreakable email": `SheetTitle and SheetDescription: ${NO_WRAP}`,
    "overflow:columns:worst: unbreakable email": `Column (minWidth 0) lets its text spill: ${NO_WRAP}`,
    "overflow:accordion:worst: unbreakable email": `Accordion trigger and content: ${NO_WRAP}`,
    "clip:accordion:worst: unbreakable email": `AccordionContent clips (overflow: hidden, for the open/close animation): ${NO_WRAP}`,
    "overflow:text-area:worst: one-character label, unbreakable hint": `FieldLabel hint: ${NO_WRAP}`,
    "overflow:time-input:worst: long label and unbreakable hint": `FieldLabel hint: ${NO_WRAP}`,
    "overflow:stepper:worst: unbreakable email": `step title and description: ${NO_WRAP}`,
    "overflow:status-banner:worst: unbreakable email": `StatusBanner text: ${NO_WRAP}`,
    "overflow:banner-stack:worst: unbreakable email": `the StatusBanner inside: ${NO_WRAP}`,
    "overlay:alert-dialog:worst: unbreakable email": `AlertDialogTitle and AlertDialogDescription: ${NO_WRAP}`,
    "overflow:stat-card:worst: unbreakable email": `StatCard: ${NO_WRAP}`,
};
