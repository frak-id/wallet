/** `<overflow|clip|focus|overlay|pointer>:<section id>:<case name>` → reason; the spec fails when an entry stops occurring. */

const UNBREAKABLE =
    "a string with no break opportunity keeps its flex or grid item at full width; break-word only wraps it once the item is already narrower";

export const knownFindings: Record<string, string> = {
    "overflow:accordion:worst: unbreakable email": UNBREAKABLE,
    "overflow:banner-stack:worst: unbreakable email": UNBREAKABLE,
    "overflow:box:worst: unbreakable email": UNBREAKABLE,
    "overflow:button:worst: huge number": UNBREAKABLE,
    "overflow:button:worst: unbreakable email": UNBREAKABLE,
    "overflow:empty-state:worst: unbreakable email": UNBREAKABLE,
    "overflow:field-error:worst: unbreakable email": UNBREAKABLE,
    "overflow:field-label:worst: unbreakable email": UNBREAKABLE,
    "overflow:inline:worst: unbreakable email": UNBREAKABLE,
    "overflow:input:worst: one-character label, unbreakable hint": UNBREAKABLE,
    "overflow:radio-group:worst: unbreakable email": UNBREAKABLE,
    "overflow:spread:worst: unbreakable email": UNBREAKABLE,
    "overflow:stack:worst: unbreakable email": UNBREAKABLE,
    "overflow:stat-card:worst: unbreakable email": UNBREAKABLE,
    "overflow:status-banner:worst: unbreakable email": UNBREAKABLE,
    "overflow:text-area:worst: one-character label, unbreakable hint":
        UNBREAKABLE,
    "overflow:text:worst: huge number": UNBREAKABLE,
    "overflow:text:worst: unbreakable email": UNBREAKABLE,
    "overflow:time-input:worst: long label and unbreakable hint": UNBREAKABLE,
    "overflow:toast-surface:worst: unbreakable email": UNBREAKABLE,
    "overlay:alert-dialog:worst: unbreakable email": UNBREAKABLE,
    "overlay:drawer:worst: unbreakable email": UNBREAKABLE,
};
