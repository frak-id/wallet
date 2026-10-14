const NO_WRAP =
    "a string with no break opportunity cannot shrink below its width, and nothing here wraps, clips or ellipsizes it";

const FOCUS_TOKEN =
    "the ring is border.focus (grey400, #a3a3a3), 2.41:1 on the page background where WCAG 1.4.11 asks for 3:1";
const FOCUS_FLUSH = `${FOCUS_TOKEN}, and it sits flush on a fill that is no better`;

/**
 * Findings the gallery surfaces in current component code, keyed
 * `<overflow|focus>:<section id>:<case name>`; the value is the reason.
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
    "overflow:input:length medium":
        'length="medium" is a fixed 320px, wider than the 288px a 320px viewport leaves after page padding',
    "overflow:input:worst: one-character label, unbreakable hint": `FieldLabel hint: ${NO_WRAP}`,
    "overflow:select:length medium":
        'length="medium" is a fixed 320px, wider than the 288px a 320px viewport leaves after page padding',
    "overflow:select:worst: unbreakable email selected": `SelectValue in the trigger does not truncate: ${NO_WRAP}`,
    "overflow:tabs:worst: five long labels":
        "triggers are nowrap and TabsList neither scrolls nor wraps, so the list grows past the viewport",
    "overflow:notice:worst: unbreakable email": `Notice content (minWidth 0) lets the text spill out of the tinted box: ${NO_WRAP}`,
    "overflow:badge:worst: unbreakable email":
        "Badge is nowrap with no truncation",
    "overflow:badge:worst: long sentence": "Badge is nowrap with no truncation",
    "overflow:badge:worst: non-Latin and emoji":
        "Badge is nowrap with no truncation",

    "focus:input:variant bare":
        "inputField sets outline: none and the bare wrapper has no :focus-within style, so focus is invisible",
    "focus:input:error bare":
        "inputField sets outline: none and the bare wrapper has no :focus-within style, so focus is invisible",
    "focus:input:bare tone muted":
        "inputField sets outline: none and the bare wrapper has no :focus-within style, so focus is invisible",
    "focus:input:variant soft":
        "inputField sets outline: none and the soft wrapper has no :focus-within style, so focus is invisible",
    "focus:input:error soft":
        "inputField sets outline: none and the soft wrapper has no :focus-within style, so focus is invisible",
    "focus:tabs:panel":
        "TabsContent is a tabindex=0 panel and tabsContent sets outline: none, so focus is invisible",

    "focus:button:variant primary": FOCUS_TOKEN,
    "focus:button:variant secondary": FOCUS_TOKEN,
    "focus:button:variant ghost": FOCUS_TOKEN,
    "focus:button:variant destructive": FOCUS_TOKEN,
    "focus:button:variant filter": FOCUS_TOKEN,
    "focus:button:size small": FOCUS_TOKEN,
    "focus:button:size medium": FOCUS_TOKEN,
    "focus:button:size large": FOCUS_TOKEN,
    "focus:button:size none": FOCUS_TOKEN,
    "focus:button:size filter": FOCUS_TOKEN,
    "focus:button:width full in 200px": FOCUS_TOKEN,
    "focus:button:font size xl": FOCUS_TOKEN,
    "focus:button:icons": FOCUS_TOKEN,
    "focus:button:as link": FOCUS_TOKEN,
    "focus:button:as link disabled": FOCUS_TOKEN,
    "focus:button:worst: unbreakable email": FOCUS_TOKEN,
    "focus:button:worst: long sentence": FOCUS_TOKEN,
    "focus:button:worst: one character": FOCUS_TOKEN,
    "focus:button:worst: huge number": FOCUS_TOKEN,
    "focus:button:worst: non-Latin and emoji": FOCUS_TOKEN,
    "focus:checkbox:unchecked": FOCUS_TOKEN,
    "focus:checkbox:checked": FOCUS_TOKEN,
    "focus:checkbox:indeterminate": FOCUS_TOKEN,
    "focus:checkbox:size l": FOCUS_TOKEN,

    "focus:select:default": FOCUS_FLUSH,
    "focus:select:length medium": FOCUS_FLUSH,
    "focus:select:length big": FOCUS_FLUSH,
    "focus:select:bare elevated": FOCUS_FLUSH,
    "focus:select:bare muted": FOCUS_FLUSH,
    "focus:select:placeholder": FOCUS_FLUSH,
    "focus:select:worst: unbreakable email selected": FOCUS_FLUSH,
    "focus:select:worst: non-Latin and emoji selected": FOCUS_FLUSH,
    "focus:tabs:segmented": FOCUS_FLUSH,
    "focus:tabs:navigation": FOCUS_FLUSH,
    "focus:tabs:segmented full width in 280px": FOCUS_FLUSH,
    "focus:tabs:navigation full width in 280px": FOCUS_FLUSH,
    "focus:tabs:disabled trigger": FOCUS_FLUSH,
    "focus:tabs:worst: five long labels": FOCUS_FLUSH,
    "focus:switch:off": FOCUS_FLUSH,
    "focus:switch:on": FOCUS_FLUSH,
};
