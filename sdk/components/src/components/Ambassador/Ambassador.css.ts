import { style } from "@vanilla-extract/css";
import { buttonReset } from "@/styles/sharedBaseCss.css";

// Sizes are em, never rem: merchant themes redefine the root font size
// (PrestaShop commonly sets html{font-size:10px}). Colours and fonts inherit.

const SUPPORTS_COLOR_MIX = "(color: color-mix(in srgb, red 4%, transparent))";
const TINTS = {
    surface: [4, "rgba(17,17,17,.04)"],
    border: [15, "rgba(17,17,17,.15)"],
} as const;

/** Surface and border follow the accent; below Safari 16.2 (no color-mix) they stay neutral. */
function tint(knob: keyof typeof TINTS, mixed: boolean): string {
    const [percent, neutral] = TINTS[knob];
    const fallback = mixed
        ? `color-mix(in srgb, var(--frak-amb-accent, #111) ${percent}%, transparent)`
        : neutral;
    return `var(--frak-amb-${knob}, ${fallback})`;
}

const tintedBorder = (mixed: boolean) => `1px solid ${tint("border", mixed)}`;

const ACCENT = "var(--frak-amb-accent, #111)";
const INK = "var(--frak-amb-accent-ink, #fff)";
// The accent where it is text on our backdrop; a sampler that finds it too light points this at the text colour.
const ACCENT_TEXT = "var(--frak-amb-accent-text, var(--frak-amb-accent, #111))";
const RADIUS = "var(--frak-amb-radius, 12px)";
const CTA_RADIUS = "var(--frak-amb-cta-radius, 999px)";

/** Auto-fit columns that collapse to one below `min`, without overflowing a narrower container. */
const autoFit = (min: string) =>
    `repeat(auto-fit, minmax(min(${min}, 100%), 1fr))`;

const panel = style({
    backgroundColor: tint("surface", false),
    border: tintedBorder(false),
    borderRadius: RADIUS,

    "@supports": {
        [SUPPORTS_COLOR_MIX]: {
            backgroundColor: tint("surface", true),
            border: tintedBorder(true),
        },
    },
});

export const root = style({
    display: "flex",
    flexDirection: "column",
    gap: "clamp(3em, 7vw, 5.5em)",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
});

const ctaButton = style([
    buttonReset,
    {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.95em 2em",
        borderRadius: CTA_RADIUS,
        backgroundColor: `var(--frak-amb-cta-bg, ${ACCENT})`,
        color: INK,
        fontSize: "var(--frak-amb-cta-size, 0.9em)",
        fontWeight: "var(--frak-amb-cta-weight, 700)",
        letterSpacing: "var(--frak-amb-cta-spacing, 0.06em)",
        textTransform: "var(--frak-amb-cta-transform, uppercase)",
        textDecoration: "none",
        cursor: "pointer",

        selectors: {
            "&:hover": {
                opacity: 0.85,
            },
            "&:disabled": {
                opacity: 0.5,
                cursor: "default",
            },
            // A filled CTA's ink is light, and currentColor would draw the
            // ring in it against the merchant's page. White inside, dark
            // outside: one band reads whatever either surface is.
            "&:focus-visible": {
                outlineColor: "#000",
                boxShadow: "0 0 0 2px #fff",
            },
        },
    },
]);

const region = style({
    display: "grid",
    gap: "0.85em",
    alignContent: "start",
    minWidth: 0,
    margin: 0,
});

const centeredRegion = style([
    region,
    {
        justifyItems: "center",
        textAlign: "center",
    },
]);

const H2_SIZE = "var(--frak-amb-h2-size, clamp(1.4em, 2.6vw, 2em))";

const regionTitle = style({
    margin: 0,
    fontSize: H2_SIZE,
    lineHeight: 1.2,
    fontWeight: "var(--frak-amb-h2-weight, inherit)",
    letterSpacing: "var(--frak-amb-h2-spacing, normal)",
    color: "var(--frak-amb-h2-color, inherit)",
});

const lede = style({
    margin: 0,
    maxWidth: "52ch",
    opacity: 0.75,
});

const mutedSmall = style({
    margin: 0,
    fontSize: "0.85em",
    opacity: 0.7,
});

const muted = style({
    margin: 0,
    opacity: 0.7,
});

const card = style([
    panel,
    {
        display: "grid",
        gap: "0.5em",
        alignContent: "start",
        padding: "1.4em",
    },
]);

/** The currency beside a big figure, drawn smaller as L does. */
export const amountUnit = style({
    fontSize: "0.32em",
    fontWeight: 700,
    letterSpacing: "normal",
});

// A worded fallback ("A reward") set at figure size overflows a phone.
export const amountWords = style({
    display: "inline-block",
    fontSize: "0.45em",
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
});

const bigFigure = style({
    fontWeight: 800,
    lineHeight: 0.85,
    letterSpacing: "-0.04em",
    color: ACCENT_TEXT,
});

// ─── Hero ─────────────────────────────────────────────────

export const hero = style([
    region,
    {
        gap: "2.5em",
        gridTemplateColumns: autoFit("18em"),
        alignItems: "center",
    },
]);

export const heroBody = style({
    display: "grid",
    gap: "1em",
    alignContent: "start",
    justifyItems: "start",
    minWidth: 0,
});

export const heroEyebrow = mutedSmall;

export const heroTitle = style({
    margin: 0,
    fontSize: "var(--frak-amb-h1-size, clamp(2em, 4.6vw, 3.2em))",
    lineHeight: 1.1,
    fontWeight: "var(--frak-amb-h1-weight, inherit)",
    letterSpacing: "var(--frak-amb-h1-spacing, normal)",
    color: "var(--frak-amb-h1-color, inherit)",
});

export const heroLede = lede;

export const heroCta = ctaButton;

export const heroFaces = mutedSmall;

// Without a merchant photo the frame collapses around the reward card.
export const heroArt = style([
    panel,
    {
        position: "relative",
        display: "grid",
        placeItems: "center",
        padding: "1em",
        background: "var(--frak-amb-image, none) center/cover",
    },
]);

export const heroArtFramed = style({
    aspectRatio: "4 / 5",
    alignContent: "end",
});

export const heroImage = style({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: RADIUS,
});

export const heroTag = style({
    position: "relative",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "0.75em",
    boxSizing: "border-box",
    width: "100%",
    padding: "0.9em 1em",
    borderRadius: RADIUS,
    backgroundColor: "var(--frak-amb-tag-bg, #fff)",
    textAlign: "start",
});

export const heroTagMain = style({
    display: "grid",
});

export const heroAmount = style({
    fontSize: "1.4em",
    lineHeight: 1.1,
    color: ACCENT_TEXT,
});

export const heroRewardCaption = style({
    fontSize: "0.8em",
    opacity: 0.7,
});

export const heroPill = style({
    marginInlineStart: "auto",
    padding: "0.45em 0.8em",
    borderRadius: CTA_RADIUS,
    backgroundColor: ACCENT,
    color: INK,
    fontSize: "0.72em",
    fontWeight: 700,
    letterSpacing: "0.04em",
});

// ─── Reward amount ────────────────────────────────────────

export const reward = centeredRegion;

export const rewardEyebrow = mutedSmall;

// The heading keeps the body size so the figure inside it scales from the
// page, not from a host h2 size; its words take the h2 size on their own span.
export const rewardHeading = style([regionTitle, { fontSize: "1em" }]);

export const rewardHeadingText = style({ fontSize: H2_SIZE });

export const rewardAmount = style([
    bigFigure,
    {
        display: "block",
        marginBlockEnd: "0.12em",
        fontSize: "clamp(3.5em, 14vw, 7em)",
    },
]);

export const rewardCaption = mutedSmall;

export const rewardLede = lede;

export const rewardCta = ctaButton;

export const rewardFooter = mutedSmall;

// ─── Explainer steps ──────────────────────────────────────

export const steps = region;

export const stepsTitle = regionTitle;

export const stepsLede = lede;

export const stepsGrid = style({
    display: "grid",
    gap: "1.25em",
    gridTemplateColumns: autoFit("15em"),
});

export const step = card;

export const stepNumber = style({
    display: "grid",
    placeItems: "center",
    inlineSize: "1.9em",
    blockSize: "1.9em",
    margin: 0,
    borderRadius: CTA_RADIUS,
    backgroundColor: ACCENT,
    color: INK,
    fontSize: "0.9em",
    fontWeight: 700,
});

export const stepIcon = style({
    width: "40px",
    height: "40px",
    objectFit: "contain",
});

export const stepTitle = style({
    margin: 0,
    fontSize: "1.05em",
    lineHeight: 1.3,
});

export const stepDescription = muted;

// ─── Win-win ──────────────────────────────────────────────

export const winWin = centeredRegion;

export const winWinTitle = regionTitle;

export const winWinLede = lede;

export const winWinCards = style({
    display: "grid",
    gap: "1.25em",
    gridTemplateColumns: autoFit("15em"),
    width: "100%",
    maxWidth: "40em",
});

export const winWinCard = style([
    card,
    {
        justifyItems: "center",
        textAlign: "center",
    },
]);

export const winWinCardLabel = mutedSmall;

export const winWinCardAmount = style([
    bigFigure,
    {
        margin: 0,
        fontSize: "clamp(2em, 6vw, 3em)",
    },
]);

export const winWinCardDescription = stepDescription;

// ─── Referral block ───────────────────────────────────────

export const referral = region;

export const referralTitle = regionTitle;

export const referralLede = lede;

export const referralCta = style([ctaButton, { justifySelf: "start" }]);

// ─── Store block ──────────────────────────────────────────

export const store = style([
    panel,
    {
        display: "grid",
        gap: "1.75em",
        gridTemplateColumns: autoFit("14em"),
        alignItems: "center",
        padding: "1.75em",
    },
]);

export const storeBody = style({
    display: "grid",
    gap: "0.75em",
    alignContent: "start",
    minWidth: 0,
});

export const storeQr = style({
    display: "grid",
    justifyItems: "center",
    gap: "0.5em",
    margin: 0,
    textAlign: "center",
});

export const storeQrCaption = mutedSmall;

export const storeTitle = regionTitle;

export const storeLede = lede;

export const storeBadges = style({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "0.75em",
});

export const storeBadge = style([
    buttonReset,
    {
        display: "inline-flex",
        alignItems: "center",
        textDecoration: "none",
        // Brand-locked: host stylesheets may not repaint these two.
        backgroundColor: "#000 !important",
        color: "#fff !important",
        borderRadius: "8px",
        overflow: "hidden",
        // Lockup dimensions are the vendors'; both badges share one height.
        lineHeight: 0,
        selectors: {
            // White inner touches the black badge (21:1); black outer the host page.
            "&:focus-visible": {
                outlineColor: "#000",
                boxShadow: "0 0 0 2px #fff",
            },
        },
    },
]);

export const storeBadgeArt = style({
    display: "block",
    height: "40px",
    width: "auto",
});

// ─── FAQ + closing link ───────────────────────────────────

export const faq = region;

export const faqTitle = regionTitle;

export const faqItem = style({
    padding: "0.9em 0",
    borderBottom: tintedBorder(false),

    "@supports": {
        [SUPPORTS_COLOR_MIX]: { borderBottom: tintedBorder(true) },
    },
});

export const faqQuestion = style({
    cursor: "pointer",
    fontWeight: 700,
    listStyle: "none",

    selectors: {
        "&::-webkit-details-marker": {
            display: "none",
        },
        "&::after": {
            content: '"+"',
            float: "right",
            marginInlineStart: "1em",
            color: ACCENT_TEXT,
            fontWeight: 700,
        },
        [`${faqItem}[open] &::after`]: {
            content: '"–"',
        },
    },
});

export const faqAnswer = style({
    margin: "0.6em 0 0",
    opacity: 0.75,
});

export const faqAttribution = style([
    mutedSmall,
    {
        textAlign: "center",
    },
]);

// Underlined on purpose: colour alone would not separate it from body text.
export const frakLink = style({
    color: "inherit",
    textDecoration: "underline",
    textUnderlineOffset: "0.15em",
});

// Injected at build time by vanillaExtractInlinePlugin with the
// compiled CSS string. Placeholder satisfies TypeScript.
export const cssSource: string = "";
