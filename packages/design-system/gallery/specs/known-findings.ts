const FIXED_HEIGHT =
    "the large size has a fixed 48px height and a 100% line-height, so a label that wraps spills above and below the button";

/**
 * Findings the gallery surfaces in current component code, keyed
 * `<overflow|focus|overlay|pointer>:<section id>:<case name>`; the value is the reason.
 * The spec asserts each still occurs: fix the component and the entry fails
 * until it is deleted, which is the signal that the bug is gone.
 */
export const knownFindings: Record<string, string> = {
    "overflow:input:length medium":
        'length="medium" is a fixed 320px, wider than the 288px a 320px viewport leaves after page padding',
    "overflow:select:length medium":
        'length="medium" is a fixed 320px, wider than the 288px a 320px viewport leaves after page padding',

    "clip:button:worst: long sentence": `Button: ${FIXED_HEIGHT}`,
    "clip:empty-state:worst: long sentence": `The action is a large Button: ${FIXED_HEIGHT}`,
};
