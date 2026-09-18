import type { FrakClient } from "@frak-labs/core-sdk";
import { getEnvironment, sdkConfigStore } from "@frak-labs/core-sdk";
import {
    displaySharingPage,
    getMerchantInformation,
} from "@frak-labs/core-sdk/actions";
import {
    applyRewardPlaceholder,
    selectBestReward,
} from "@frak-labs/core-sdk/rewards";

/**
 * Wires the three ambassador page directions to the real SDK. The page
 * structure stays in HTML; only the reward figure, the share call and the
 * install URL come from the SDK — the split the merchant templates assume.
 */

const PLACEMENT = "ambassador";

/** `--text-primary__pbq4ak0` → `--frak-text-primary`, for one `:root` rule. */
function collectRule(rule: CSSRule, into: Map<string, string>) {
    if (!(rule instanceof CSSStyleRule)) return;
    if (!rule.selectorText.includes(":root")) return;

    for (const prop of Array.from(rule.style)) {
        const named = /^--([a-z]+-[A-Za-z0-9]+)__/.exec(prop);
        if (!named) continue;
        into.set(
            `--frak-${named[1]}`,
            rule.style.getPropertyValue(prop).trim()
        );
    }
}

function collectFrakTokens(): Map<string, string> {
    const tokens = new Map<string, string>();
    for (const sheet of Array.from(document.styleSheets)) {
        try {
            for (const rule of Array.from(sheet.cssRules)) {
                collectRule(rule, tokens);
            }
        } catch {
            // Cross-origin sheet: unreadable, and never ours.
        }
    }
    return tokens;
}

/**
 * Re-expose the design-system tokens the SDK injects, under stable names.
 * Vanilla-extract hashes the originals, so a page cannot reference them
 * directly without breaking on the next build.
 */
function adoptFrakTokens(): number {
    const tokens = collectFrakTokens();
    for (const [name, value] of tokens) {
        document.documentElement.style.setProperty(name, value);
    }
    return tokens.size;
}

const NAV_PAGES: [string, string][] = [
    ["a", "A · Gains"],
    ["b", "B · Le club"],
    ["c", "C · Mon lien"],
    ["d", "D · Le cadeau"],
    ["f", "F · Remboursé"],
    ["h", "H · Objections"],
    ["j", "J · Le vrai chiffre"],
    ["k", "K · Le mix"],
    ["k-min", "K min · CSS minimal"],
    ["l", "L · Le parcours"],
];

/** Demo chrome only: one list for every direction, current one marked. */
function renderNav() {
    const host = document.querySelector("[data-frak-nav]");
    if (!host) return;

    const current = window.location.pathname.split("/").pop() || "index.html";

    const title = document.createElement("strong");
    title.textContent = "Direction :";
    host.append(title);

    const entries: [string, string][] = [
        ...NAV_PAGES.map(
            ([letter, label]) =>
                [`ambassador-${letter}.html`, label] as [string, string]
        ),
        ["index.html", "← Index"],
    ];
    for (const [file, label] of entries) {
        const link = document.createElement("a");
        link.href = file;
        link.textContent = label;
        if (file === current) link.className = "on";
        host.append(link);
    }

    const slot = document.createElement("span");
    slot.className = "sp";
    slot.dataset.frakStatus = "";
    slot.textContent = "SDK : démarrage…";
    host.append(slot);
}

function status(message: string) {
    const el = document.querySelector("[data-frak-status]");
    if (el) el.textContent = message;
}

function waitForClient(): Promise<FrakClient> {
    if (window.FrakSetup?.client) {
        return Promise.resolve(window.FrakSetup.client);
    }
    return new Promise((resolve) => {
        const onClient = () => {
            const client = window.FrakSetup?.client;
            if (!client) return;
            window.removeEventListener("frak:client", onClient);
            resolve(client);
        };
        window.addEventListener("frak:client", onClient);
    });
}

/**
 * Same selection `useReward` performs, resolved for both sides of the
 * referral from one merchant fetch. Percentage payouts carry no amount to
 * advertise, so they resolve as no-reward and the page keeps its
 * built-in wording.
 */
async function resolveRewards(
    client: FrakClient
): Promise<{ referrer?: string; referee?: string }> {
    try {
        const merchantInfo = await getMerchantInformation(client);
        const select = (audience: "referrer" | "referee") => {
            const best = selectBestReward(merchantInfo.rewards, {
                currency: client.config.metadata?.currency,
                targetInteraction: "referral",
                audience,
            });
            return best && best.payoutType !== "percentage"
                ? best.formatted
                : undefined;
        };
        return { referrer: select("referrer"), referee: select("referee") };
    } catch {
        // Reward text is non-critical — the page renders without it.
    }
    return {};
}

/**
 * The trailing currency sign is separated so an authored `<small>` can keep
 * carrying it; a leading sign ($7.20) must stay glued to the number.
 */
function splitFormattedReward(
    formatted: string
): { lead: string; trail: string } | undefined {
    const match = /^(.*\d)([^\d]+)$/.exec(formatted.trim());
    if (!match?.[2].trim()) return undefined;
    return { lead: match[1], trail: match[2] };
}

/**
 * `data-frak-reward` and `data-frak-reward-referee` with no value swap the
 * element text for the amount; with a value they are templates carrying
 * `{REWARD}`. The markup already holds a readable fallback, so a failed
 * lookup changes nothing. A bare `{REWARD}` over a styled `<small>` keeps
 * that child: only the number is rewritten, the sign stays small.
 */
function applyRewards(rewards: { referrer?: string; referee?: string }) {
    const apply = (
        selector: string,
        key: string,
        reward: string | undefined
    ) => {
        for (const el of document.querySelectorAll<HTMLElement>(selector)) {
            if (!reward) continue;
            const template = el.dataset[key]?.trim() || "{REWARD}";
            const whole = applyRewardPlaceholder(template, reward);
            const parts =
                template === "{REWARD}"
                    ? splitFormattedReward(reward)
                    : undefined;
            const tail = el.lastElementChild;
            const head = el.firstChild;
            if (!parts || !tail || !head || head.nodeType !== Node.TEXT_NODE) {
                el.textContent = whole;
                continue;
            }
            const pad = /^\s*/.exec(tail.textContent ?? "")?.[0] ?? "";
            head.textContent = parts.lead;
            tail.textContent = `${pad}${parts.trail.trimStart()}`;
        }
    };
    apply("[data-frak-reward]", "frakReward", rewards.referrer);
    apply("[data-frak-reward-referee]", "frakRewardReferee", rewards.referee);
}

function bindShare(client: FrakClient) {
    const buttons = document.querySelectorAll<HTMLElement>("[data-frak-share]");
    for (const button of buttons) {
        button.removeAttribute("disabled");
        button.addEventListener("click", async (event) => {
            event.preventDefault();
            try {
                await displaySharingPage(client, {}, PLACEMENT);
            } catch (error) {
                status(`Partage : ${error}`);
            }
        });
    }
}

/**
 * Uncredentialed on purpose: `getInstallUrl` would add `&a=`/`#p=` so the
 * install is attributed, which measures nothing on a demo and would drag a
 * new core-sdk export along. The destination is the same real page.
 */
function bindInstall(merchantId: string | undefined) {
    const badges = document.querySelectorAll<HTMLAnchorElement>(
        "[data-frak-install]"
    );
    if (!badges.length || !merchantId) return;

    const url = `${getEnvironment().wallet}/install?m=${encodeURIComponent(merchantId)}`;
    for (const badge of badges) {
        badge.href = url;
        badge.removeAttribute("aria-disabled");
    }
}

/** An emphasis state shouts against the page; a container whispers. */
const QUIET_BORDER_DISTANCE = 120;

/** A fill this close to the page cannot read as a button. */
const FLAT_FILL_DISTANCE = 30;

/** Under this WCAG ratio a sampled text colour is unreadable on our backdrop. */
const READABLE_CONTRAST = 3;

/** Computed colours are `rgb()`, `rgba()` or `color(srgb ... / a)`. */
function alphaOf(value: string): number {
    const slash = /\/\s*([\d.]+)(%?)\s*\)/.exec(value);
    if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1);
    const parts = value.match(/[\d.]+/g);
    if (!parts) return 0;
    if (/^rgba/.test(value) && parts.length >= 4) return Number(parts[3]);
    return 1;
}

/** A sample that renders as nothing must never be written as a knob. */
function isTransparent(value: string | undefined): boolean {
    if (!value || value === "transparent") return true;
    return /^(rgba?|color)\(/.test(value) && alphaOf(value) === 0;
}

function rgbOf(value: string): [number, number, number] {
    const parts = (value.match(/[\d.]+/g) ?? []).map(Number);
    if (parts.length < 3) return [0, 0, 0];
    // `color(srgb ...)` carries 0-1 channels; everything else is 0-255.
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

/** RGB distance cannot separate white from sage; relative luminance can. */
function contrastRatio(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

/** Flatten a translucent colour onto the opaque one beneath it. */
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

/* Common nouns, never vendor names: a widget classed only in its own brand
   defeats this, which is why structure decides first. */
const WIDGET_WORDS =
    /cookie|consent|newsletter|popup|modal|sr-only|visually-hidden|skip-to/i;

function names(el: Element): string {
    return `${el.getAttribute("class") ?? ""} ${el.id}`;
}

function inCartForm(el: HTMLElement): boolean {
    return (
        el.closest('form[action*="/cart"], form[action*="/panier"]') !== null
    );
}

/* A form asking for an address is a signup, whoever ships it. Divi names the
   field without giving it a type, so the name attribute counts too. */
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

/* Stops below <body>: consent plugins stamp state classes on the root, and
   matching there would reject every button on the page. */
function insideWidget(el: HTMLElement): boolean {
    if (inSignupForm(el)) return true;
    const cart = inCartForm(el);
    let node: Element | null = el;
    while (node && node !== document.body) {
        if (WIDGET_WORDS.test(names(node))) return true;
        if (!cart && isOverlayBox(node)) return true;
        node = node.parentElement;
    }
    return false;
}

/* The nearest painted ancestor, not the page: a pale button on a pale panel
   reads as flat even when the body behind them is white. */
function backdropOf(el: HTMLElement): string {
    let node: HTMLElement | null = el.parentElement;
    while (node) {
        const bg = getComputedStyle(node).backgroundColor;
        if (!isTransparent(bg)) return bg;
        node = node.parentElement;
    }
    return pageBackground();
}

/* Parked off-side is how a closed drawer hides a real CTA that still
   measures full size. */
function isOnScreen(el: HTMLElement): boolean {
    const r = el.getBoundingClientRect();
    return r.right > 0 && r.left < window.innerWidth;
}

/** Readable brand: laid out, not hidden, and unlike the page behind it. */
function isBrandButton(el: HTMLElement): boolean {
    if (insideWidget(el)) return false;
    if (el.offsetWidth < 80 || el.offsetHeight < 20) return false;
    if (!isOnScreen(el)) return false;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden") return false;
    if (isTransparent(style.backgroundColor)) return false;
    return (
        colourDistance(style.backgroundColor, backdropOf(el)) >
        FLAT_FILL_DISTANCE
    );
}

/**
 * A store's primary button is its most reliable brand carrier: our markup
 * cannot match a `.product-single__title`, but it can read what that button
 * computed. The cart submit leads only when it is itself visible.
 */
function findPrimaryButton(page: HTMLElement): HTMLElement | undefined {
    const cartSubmit = document.querySelector<HTMLElement>(
        'form[action*="/cart/add"] [type="submit"], form[action*="/cart"] button[type="submit"]'
    );
    if (cartSubmit && !page.contains(cartSubmit) && isBrandButton(cartSubmit)) {
        return cartSubmit;
    }

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

/** Is this a quiet container we can copy, rather than a selected state? */
function isQuietContainer(el: HTMLElement, page: HTMLElement, pageBg: string) {
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

/**
 * Card rounding does not follow the button: oolution pairs square buttons with
 * 4-8px cards, Saint Lazare pairs 25px pill buttons with square ones.
 */
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

/** A heading inside chrome, or a wordmark, is not a content heading. */
const CHROME = "header,nav,[role=banner]";
const LOGO_HINT = /logo|brand|site-title|wordmark/i;

function isContentHeading(el: HTMLElement): boolean {
    if (el.closest(CHROME)) return false;
    return !LOGO_HINT.test(`${el.className} ${el.id}`);
}

/**
 * A hidden heading is still the merchant's typography, but chrome never is:
 * sampling nothing leaves our own clamp() in place, which beats a wordmark.
 */
function hostElement(page: HTMLElement, selector: string) {
    const theirs = Array.from(
        document.querySelectorAll<HTMLElement>(selector)
    ).filter((el) => !page.contains(el));
    const visible = theirs.filter((el) => el.offsetHeight > 0);
    return visible.find(isContentHeading) ?? theirs.find(isContentHeading);
}

/** Typographic values only: nothing here can move a box. */
function typographyOf(
    el: HTMLElement | undefined,
    role: string,
    backdrop: string
) {
    if (!el) return [];
    const s = getComputedStyle(el);
    const knobs = [
        [`${role}-size`, s.fontSize],
        [`${role}-weight`, s.fontWeight],
        [`${role}-spacing`, s.letterSpacing],
    ];
    // A colour chosen for the merchant's backdrop can vanish on ours.
    const readable =
        contrastRatio(composite(s.color, backdrop), backdrop) >=
        READABLE_CONTRAST;
    if (readable) knobs.push([`${role}-color`, s.color]);
    return knobs;
}

/** The merchant elements the knobs come from, resolved once. */
type ThemeSource = {
    pageBg: string;
    buttonBg: string;
    h1?: HTMLElement;
    h2?: HTMLElement;
    button?: HTMLElement;
    radius?: string;
};

/**
 * Sample the host page while its content is still laid out: merchant themes
 * keep their scale in classes our markup cannot match, and a hidden element
 * reports computed colours but measures zero.
 */
function sampleTheme(page: HTMLElement): ThemeSource {
    const pageBg = pageBackground();
    const button = findPrimaryButton(page);
    return {
        pageBg,
        buttonBg: button ? getComputedStyle(button).backgroundColor : pageBg,
        h1: hostElement(page, "h1"),
        h2: hostElement(page, "h2"),
        button,
        radius: sampleCardRadius(page),
    };
}

/** Re-read the remembered elements: hidden or not, they are still theirs. */
function knobsFrom(source: ThemeSource): string[][] {
    const knobs: string[][] = [
        ...typographyOf(source.h1, "h1", source.pageBg),
        ...typographyOf(source.h2, "h2", source.pageBg),
        ...typographyOf(source.button, "cta", source.buttonBg),
    ];
    if (source.radius) knobs.push(["radius", source.radius]);
    if (source.button) {
        const from = getComputedStyle(source.button);
        knobs.push(
            ["accent", from.backgroundColor],
            ["accent-ink", from.color],
            ["cta-radius", from.borderRadius.split(" ")[0]],
            ["cta-transform", from.textTransform]
        );
    }
    return knobs;
}

/** A sample that renders as nothing is never written. */
function applyTheme(page: HTMLElement, source: ThemeSource): string {
    let written = 0;
    for (const [knob, value] of knobsFrom(source)) {
        if (!value || isTransparent(value)) continue;
        page.style.setProperty(`--frak-amb-${knob}`, value);
        written += 1;
    }
    return written
        ? `${written} valeurs échantillonnées`
        : "rien à échantillonner";
}

/** Sample then apply, for the console call and the resize re-sample. */
function autoTheme(): string {
    const page = document.querySelector<HTMLElement>("[data-frak-page]");
    if (!page) return "pas de bloc";
    return applyTheme(page, sampleTheme(page));
}

/*
 * Classes that exist for scripts, not for looks.
 */
const BLOCKED = /^(js-|needsclick|swiper|gtm|ga-|fb-|track|lazy|no-js|data-)/i;
/* A class that can move a box is never adopted. */
const LAYOUT =
    /^(position|display|width|min-width|max-width|height|min-height|max-height|margin|float|grid|flex|inset|top|left|right|bottom|transform|overflow)/;
const TYPO =
    /^(font|letter-spacing|text-transform|text-decoration|color|line-height|white-space)/;

let cloned: { el: HTMLElement; classes: string[] }[] | null = null;

/**
 * A class is adoptable only if some rule bearing it sets typography and no
 * rule bearing it moves a box. Behavioural classes are refused outright.
 */
function adoptableClass(cls: string): boolean {
    if (BLOCKED.test(cls)) return false;
    let typographic = false;
    for (const rule of classRulesFor(cls)) {
        for (const prop of Array.from(rule.style)) {
            if (LAYOUT.test(prop)) return false;
            if (TYPO.test(prop)) typographic = true;
        }
    }
    return typographic;
}

/** Rules of any readable sheet whose selector mentions `.${cls}`. */
function classRulesFor(cls: string): CSSStyleRule[] {
    const rules: CSSStyleRule[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
        try {
            for (const rule of Array.from(sheet.cssRules)) {
                if (!(rule instanceof CSSStyleRule)) continue;
                if (
                    rule.selectorText
                        ?.split(",")
                        .some((sel) => sel.includes(`.${cls}`))
                )
                    rules.push(rule);
            }
        } catch {
            // Cross-origin sheet: unreadable, and never ours.
        }
    }
    return rules;
}

function undoClone(): string {
    for (const { el, classes } of cloned ?? []) {
        el.classList.remove(...classes);
        delete el.dataset.frakCloned;
    }
    cloned = null;
    return "classes retirées";
}

/**
 * Opt-in pass (console only) copying the theme's own title classes onto ours.
 * On both field-tested storefronts it adopted nothing the computed sampling
 * had not already captured — kept for stores whose theme layers in classes.
 */
function cloneClasses(): string {
    undoClone();
    const page = document.querySelector<HTMLElement>("[data-frak-page]");
    if (!page) return "pas de bloc";
    const before = page.scrollHeight;
    const report: string[] = [];
    for (const tag of ["h1", "h2"] as const) {
        const line = adoptTagClasses(page, tag);
        if (line) report.push(line);
    }
    const after = page.scrollHeight;
    if (after > before * 2 || after < before / 2) {
        undoClone();
        return `annulé : hauteur ${before}px → ${after}px`;
    }
    return report.join(" | ") || "rien à adopter";
}

/** Adopt one title level at a time, so each line of the report is atomic. */
function adoptTagClasses(page: HTMLElement, tag: string): string | undefined {
    const source = hostElement(page, tag);
    if (!source) return undefined;
    const classes = String(source.className || "")
        .split(/\s+/)
        .filter(Boolean)
        .filter(adoptableClass);
    if (!classes.length) return `${tag} : aucune classe adoptable`;
    for (const el of page.querySelectorAll<HTMLElement>(tag)) {
        el.dataset.frakCloned = classes.join(" ");
        el.classList.add(...classes);
    }
    return `${tag} ← ${classes.join(" ")}`;
}

/**
 * Re-sample on resize: the merchant scale is responsive, ours would otherwise
 * keep whatever width it was first measured at.
 */
function watchViewport() {
    let timer: ReturnType<typeof setTimeout>;
    window.addEventListener("resize", () => {
        clearTimeout(timer);
        timer = setTimeout(autoTheme, 200);
    });
}

async function init() {
    status("SDK : en attente du client…");
    const client = await waitForClient();

    // Base CSS lands with the loader, so the tokens exist by the time a
    // client does.
    const tokens = adoptFrakTokens();

    const merchantId =
        sdkConfigStore.getMerchantId() ??
        (await sdkConfigStore.resolveMerchantId());

    bindShare(client);
    bindInstall(merchantId);

    const rewards = await resolveRewards(client);
    applyRewards(rewards);

    status(
        `SDK prêt · marchand ${merchantId ?? "non résolu"} · récompense ${rewards.referrer ?? "non résolue"} / filleul ${rewards.referee ?? "non résolue"} · ${tokens} tokens · auto-thème : ${autoTheme()}`
    );
}

renderNav();
watchViewport();
const consoleApi = { cloneClasses, undoClone };
void init();

declare global {
    interface Window {
        __frakAmb?: typeof consoleApi;
    }
}
window.__frakAmb = consoleApi;
