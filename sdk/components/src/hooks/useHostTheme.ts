import { useEffect } from "preact/hooks";

type Knob = [name: string, value: string];

/** Anything with a `.current`, so any ref object satisfies it structurally. */
export type HostThemeTarget = { current: HTMLElement | null };

type ThemeSource = {
    /** Where our headings actually render; the page behind the host's may differ. */
    backdrop: string;
    /** Our inherited text colour, flattened onto the backdrop. */
    text: string;
    bodySize: string;
    buttonBg: string;
    h1?: HTMLElement;
    h2?: HTMLElement;
    button?: HTMLElement;
    radius?: string;
};

const QUIET_BORDER_DISTANCE = 120;
const FLAT_FILL_DISTANCE = 30;
const READABLE_CONTRAST = 3;
// Below both, an accent fill does not separate from the backdrop at all; a
// light brand hue (yellow on white) fails the contrast but not the distance.
const VISIBLE_CONTRAST = 1.5;
const VISIBLE_DISTANCE = 60;
// The stylesheet's own defaults for the accent and the reward tag.
const DEFAULT_ACCENT = "rgb(17, 17, 17)";
const DEFAULT_TAG_BG = "rgb(255, 255, 255)";
const TAG_TINT = 0.08;
// A host h1 no bigger than this many body sizes is an unstyled reset, not a title style.
const RESET_HEADING_RATIO = 1.25;
const WIDGET_WORDS =
    /cookie|consent|newsletter|popup|modal|sr-only|visually-hidden|skip-to/i;
const CHROME = "header,nav,[role=banner]";
const LOGO_HINT = /logo|brand|site-title|wordmark/i;
const CLIPPING_OVERFLOW = new Set(["hidden", "clip", "auto", "scroll"]);
const FONT_ATTRIBUTE = "data-frak-amb-font";
const FONT_KNOBS = ["h1-family", "h1-transform", "h2-family", "h2-transform"];
// Unrendered theme headings a host page (the Shopify proxy page) renders for us to sample.
const REFERENCE_HEADINGS = "[data-frak-amb-ref]";

function alphaOf(value: string): number {
    const slash = /\/\s*([\d.]+)(%?)\s*\)/.exec(value);
    if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1);
    const parts = value.match(/[\d.]+/g);
    if (!parts) return 0;
    if (/^rgba/.test(value) && parts.length >= 4) return Number(parts[3]);
    return 1;
}

function isTransparent(value: string | undefined): boolean {
    if (!value || value === "transparent") return true;
    return /^(rgba?|color)\(/.test(value) && alphaOf(value) === 0;
}

function rgbOf(value: string): [number, number, number] {
    const parts = (value.match(/[\d.]+/g) ?? []).map(Number);
    // oklch(), lab() and unparseable values read as NaN, which fails every
    // threshold below closed: a colour we cannot read is never adopted.
    if (!/^(rgba?\(|color\(srgb )/.test(value) || parts.length < 3) {
        return [Number.NaN, Number.NaN, Number.NaN];
    }
    // `color(srgb ...)` carries 0-1 channels; every other format is 0-255.
    const scale = /^color\(/.test(value) ? 255 : 1;
    return [parts[0] * scale, parts[1] * scale, parts[2] * scale];
}

function colourDistance(a: string, b: string): number {
    const [r1, g1, b1] = rgbOf(a);
    const [r2, g2, b2] = rgbOf(b);
    return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

function luminance(value: string): number {
    const channel = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const [r, g, b] = rgbOf(value);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

function composite(fg: string, bg: string): string {
    const alpha = alphaOf(fg);
    if (alpha >= 1) return fg;
    const [r1, g1, b1] = rgbOf(fg);
    const [r2, g2, b2] = rgbOf(bg);
    const mix = (x: number, y: number) => x * alpha + y * (1 - alpha);
    return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`;
}

function pageBackground(): string {
    let node: HTMLElement | null = document.body;
    while (node) {
        const bg = getComputedStyle(node).backgroundColor;
        if (!isTransparent(bg)) return bg;
        node = node.parentElement;
    }
    return "rgb(255, 255, 255)";
}

function names(el: Element): string {
    return `${el.getAttribute("class") ?? ""} ${el.id}`;
}

function inCartForm(el: HTMLElement): boolean {
    return (
        el.closest('form[action*="/cart"], form[action*="/panier"]') !== null
    );
}

function inSignupForm(el: HTMLElement): boolean {
    const form = el.closest("form");
    if (!form || inCartForm(el)) return false;
    return (
        form.querySelector('input[type="email"], input[name*="email" i]') !==
        null
    );
}

function isOverlayBox(el: Element): boolean {
    const role = el.getAttribute("role");
    if (el.tagName === "DIALOG" || role === "dialog" || role === "alertdialog")
        return true;
    if (el.getAttribute("aria-modal") === "true") return true;
    return getComputedStyle(el).position === "fixed";
}

function insideWidget(el: HTMLElement): boolean {
    if (inSignupForm(el)) return true;
    // Shopify's country/currency picker: a filled control, never the brand's button.
    if (el.closest('form[action*="/localization"]')) return true;
    const cart = inCartForm(el);
    let node: Element | null = el;
    while (node && node !== document.body) {
        if (WIDGET_WORDS.test(names(node))) return true;
        if (!cart && isOverlayBox(node)) return true;
        node = node.parentElement;
    }
    return false;
}

function backdropOf(el: HTMLElement): string {
    let node: HTMLElement | null = el.parentElement;
    while (node) {
        const bg = getComputedStyle(node).backgroundColor;
        if (!isTransparent(bg)) return bg;
        node = node.parentElement;
    }
    return pageBackground();
}

function isClippedAway(el: HTMLElement, rect: DOMRect): boolean {
    let node = el.parentElement;
    while (node) {
        const style = getComputedStyle(node);
        const clips =
            CLIPPING_OVERFLOW.has(style.overflow) ||
            CLIPPING_OVERFLOW.has(style.overflowX) ||
            CLIPPING_OVERFLOW.has(style.overflowY);
        if (clips) {
            const clip = node.getBoundingClientRect();
            const outside =
                rect.bottom <= clip.top ||
                rect.top >= clip.bottom ||
                rect.right <= clip.left ||
                rect.left >= clip.right;
            if (outside) return true;
        }
        node = node.parentElement;
    }
    return false;
}

function isOnScreen(el: HTMLElement): boolean {
    const rect = el.getBoundingClientRect();
    if (rect.right <= 0 || rect.left >= window.innerWidth) return false;
    return !isClippedAway(el, rect);
}

function isBrandButton(el: HTMLElement): boolean {
    if (insideWidget(el)) return false;
    if (el.offsetWidth < 80 || el.offsetHeight < 20) return false;
    if (!isOnScreen(el)) return false;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden") return false;
    if (isTransparent(style.backgroundColor)) return false;
    const backdrop = backdropOf(el);
    return (
        colourDistance(composite(style.backgroundColor, backdrop), backdrop) >
        FLAT_FILL_DISTANCE
    );
}

function findPrimaryButton(page: HTMLElement): HTMLElement | undefined {
    const cartSubmit = document.querySelector<HTMLElement>(
        'form[action*="/cart/add"] [type="submit"], form[action*="/cart"] button[type="submit"]'
    );
    if (cartSubmit && !page.contains(cartSubmit) && isBrandButton(cartSubmit)) {
        return cartSubmit;
    }

    // `!page.contains` is the only thing keeping our own CTAs out of this
    // ranking: without it the sampler reads back the accent it just painted.
    const painted = Array.from(
        document.querySelectorAll<HTMLElement>(
            'button, .btn, [type="submit"], a.button, a.wp-block-button__link, a.et_pb_button'
        )
    ).filter((el) => !page.contains(el) && isBrandButton(el));

    return painted.sort(
        (a, b) =>
            b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight
    )[0];
}

function isQuietContainer(
    el: HTMLElement,
    page: HTMLElement,
    pageBg: string
): boolean {
    if (page.contains(el)) return false;

    const rect = el.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 60) return false;
    if (rect.width * rect.height > 500_000) return false;

    const style = getComputedStyle(el);
    if (style.position === "fixed" || style.position === "sticky") return false;

    const bordered =
        Number.parseFloat(style.borderTopWidth) > 0 &&
        !isTransparent(style.borderTopColor);
    const filled =
        !isTransparent(style.backgroundColor) &&
        style.backgroundColor !== pageBg;

    if (!bordered && !filled) return false;
    return (
        !bordered ||
        colourDistance(style.borderTopColor, pageBg) <= QUIET_BORDER_DISTANCE
    );
}

function sampleCardRadius(page: HTMLElement): string | undefined {
    const pageBg = pageBackground();
    const tally = new Map<string, number>();

    for (const el of document.querySelectorAll<HTMLElement>(
        "div,section,article,li,label"
    )) {
        if (!isQuietContainer(el, page, pageBg)) continue;
        const radius = getComputedStyle(el).borderTopLeftRadius;
        tally.set(radius, (tally.get(radius) ?? 0) + 1);
    }

    return Array.from(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
}

function isContentHeading(el: HTMLElement): boolean {
    if (el.closest(CHROME)) return false;
    return !LOGO_HINT.test(`${el.className} ${el.id}`);
}

function hostElement(
    page: HTMLElement,
    selector: string
): HTMLElement | undefined {
    const theirs = Array.from(
        document.querySelectorAll<HTMLElement>(selector)
    ).filter((el) => !page.contains(el));
    const reference = theirs.find((el) => el.closest(REFERENCE_HEADINGS));
    if (reference) return reference;
    const visible = theirs.filter((el) => el.offsetHeight > 0);
    return visible.find(isContentHeading) ?? theirs.find(isContentHeading);
}

// The page's own heading maximums: a display-sized host heading (80px hero
// titles) would otherwise swamp every section title.
const MAX_SIZE: Record<string, string> = { h1: "3.2em", h2: "2em" };

function typographyOf(
    el: HTMLElement | undefined,
    role: string,
    backdrop: string,
    withColour: boolean
): Knob[] {
    if (!el) return [];
    const s = getComputedStyle(el);
    const max = MAX_SIZE[role];
    const knobs: Knob[] = [
        [`${role}-size`, max ? `min(${s.fontSize}, ${max})` : s.fontSize],
        [`${role}-weight`, s.fontWeight],
        [`${role}-spacing`, s.letterSpacing],
    ];
    const readable =
        contrastRatio(composite(s.color, backdrop), backdrop) >=
        READABLE_CONTRAST;
    if (withColour && readable) knobs.push([`${role}-color`, s.color]);
    return knobs;
}

function headingKnobs(
    el: HTMLElement | undefined,
    role: "h1" | "h2",
    source: ThemeSource
): Knob[] {
    if (!el) return [];
    const s = getComputedStyle(el);
    const knobs: Knob[] = [
        ...typographyOf(el, role, source.backdrop, true),
        [`${role}-family`, s.fontFamily],
        [`${role}-transform`, s.textTransform],
    ];
    const bodySize = Number.parseFloat(source.bodySize);
    const isReset =
        role === "h1" &&
        Number.parseFloat(s.fontSize) <= RESET_HEADING_RATIO * bodySize;
    return isReset ? knobs.filter(([name]) => name !== "h1-size") : knobs;
}

function sampleTheme(page: HTMLElement): ThemeSource {
    const pageBg = pageBackground();
    const button = findPrimaryButton(page);
    const backdrop = backdropOf(page);
    const ours = getComputedStyle(page);
    return {
        backdrop,
        text: composite(ours.color, backdrop),
        bodySize: ours.fontSize,
        buttonBg: button ? getComputedStyle(button).backgroundColor : pageBg,
        h1: hostElement(page, "h1"),
        h2: hostElement(page, "h2"),
        button,
        radius: sampleCardRadius(page),
    };
}

function accentKnobs(source: ThemeSource): Knob[] {
    const from = source.button ? getComputedStyle(source.button) : undefined;
    const fill = composite(
        from?.backgroundColor ?? DEFAULT_ACCENT,
        source.backdrop
    );
    const contrast = contrastRatio(fill, source.backdrop);
    // An unmeasurable colour reads NaN, fails this test and keeps the sample.
    const vanishes =
        contrast < VISIBLE_CONTRAST &&
        colourDistance(fill, source.backdrop) <= VISIBLE_DISTANCE;
    if (vanishes) {
        return [
            ["accent", source.text],
            ["accent-ink", source.backdrop],
        ];
    }
    if (!from) return [];
    const knobs: Knob[] = [
        ["accent", from.backgroundColor],
        ["accent-ink", from.color],
    ];
    // A light brand colour still fills buttons, but as the figures' text it would not read.
    if (!(contrast >= READABLE_CONTRAST)) {
        knobs.push(["accent-text", "currentColor"]);
    }
    return knobs;
}

/** The tag keeps our inherited text colour, so light text needs a dark tag. */
function tagKnobs(source: ThemeSource): Knob[] {
    if (!(contrastRatio(source.text, DEFAULT_TAG_BG) < READABLE_CONTRAST)) {
        return [];
    }
    const [r, g, b] = rgbOf(source.text);
    const tint = `rgba(${r}, ${g}, ${b}, ${TAG_TINT})`;
    return [["tag-bg", composite(tint, source.backdrop)]];
}

function knobsFrom(source: ThemeSource): Knob[] {
    const knobs: Knob[] = [
        ...headingKnobs(source.h1, "h1", source),
        ...headingKnobs(source.h2, "h2", source),
        // The CTA reads --frak-amb-accent-ink, so a sampled cta colour would
        // write into a knob no stylesheet consumes.
        ...typographyOf(source.button, "cta", source.buttonBg, false),
    ];
    if (source.radius) knobs.push(["radius", source.radius]);
    knobs.push(...accentKnobs(source), ...tagKnobs(source));
    if (source.button) {
        const from = getComputedStyle(source.button);
        knobs.push(
            ["cta-radius", from.borderRadius.split(" ")[0]],
            ["cta-transform", from.textTransform]
        );
    }
    return knobs;
}

function knobsSignature(knobs: Knob[]): string {
    return knobs
        .map(([name, value]) => `${name}=${value}`)
        .sort()
        .join("|");
}

function writeKnobs(anchor: HTMLElement, knobs: Knob[]): void {
    // The component declares no knob of its own, so one resolving here is the
    // merchant's: their explicit value outranks a sample. Read before writing
    // any, or an inline write invalidates the reads that follow it.
    const current = getComputedStyle(anchor);
    const merchantSet = new Set(
        knobs
            .map(([name]) => name)
            .filter((name) =>
                current.getPropertyValue(`--frak-amb-${name}`).trim()
            )
    );

    for (const [name, value] of knobs) {
        // A sample that renders as nothing must not become a knob.
        if (!value || isTransparent(value)) continue;
        if (merchantSet.has(name)) continue;
        // The merchant's own accent is theirs to judge, not ours to reroute.
        if (name === "accent-text" && merchantSet.has("accent")) continue;
        anchor.style.setProperty(`--frak-amb-${name}`, value);
    }
    markFontKnobs(anchor);
}

/**
 * Heading font rules apply only behind this attribute: an unset `var()` in
 * `font-family` computes to `inherit` and would beat the theme's `h1 {}` rule.
 */
function markFontKnobs(anchor: HTMLElement): void {
    const resolved = getComputedStyle(anchor);
    const present = FONT_KNOBS.filter((name) =>
        resolved.getPropertyValue(`--frak-amb-${name}`).trim()
    );
    if (present.length) anchor.setAttribute(FONT_ATTRIBUTE, present.join(" "));
    else anchor.removeAttribute(FONT_ATTRIBUTE);
}

function nextFrame(): Promise<void> {
    return new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
    });
}

async function settled(): Promise<void> {
    // The area sort reads offset sizes, which stay wrong until webfonts land.
    if (document.fonts?.ready) await document.fonts.ready;
    await nextFrame();
}

export function useHostTheme(target: HostThemeTarget): void {
    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            try {
                await settled();
                if (cancelled) return;
                const anchor = target.current;
                if (!anchor) return;

                const first = knobsFrom(sampleTheme(anchor));
                await nextFrame();
                if (cancelled) return;
                const second = knobsFrom(sampleTheme(anchor));

                // Two samples that disagree mean the host moved between
                // frames, and a moving host offers no colour to choose.
                if (knobsSignature(first) !== knobsSignature(second)) return;

                writeKnobs(anchor, first);
            } catch {
                // This runs on a merchant's page: their page must survive it.
            }
        };
        void run();

        return () => {
            cancelled = true;
        };
    }, [target]);
}
