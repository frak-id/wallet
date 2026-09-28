import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { base } from "@frak-labs/design-system/utils";
import { keyframes, style } from "@vanilla-extract/css";
import * as explorer from "../explorer-phone/explorer-phone.css";

export const phoneShell = style([explorer.phoneShell, { flexShrink: 0 }]);

export const frameImage = explorer.frameImage;

/**
 * Scroll surface clipped to the display's rounded corners and painted above
 * the frame artwork, covering its placeholder screen and baked CTA.
 */
export const screen = style([
    base,
    {
        position: "absolute",
        top: 17,
        left: 15.5,
        width: 322,
        height: 701,
        borderRadius: 45,
        overflowY: "auto",
        scrollbarWidth: "none",
        "::-webkit-scrollbar": {
            display: "none",
        },
        backgroundColor: vars.surface.background,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        color: vars.text.primary,
        fontFamily: brand.typography.fontFamily.inter,
        fontSize: 12,
        lineHeight: 1.45,
    },
]);

export const notch = style({
    position: "sticky",
    top: 11,
    width: 94,
    height: 28,
    marginInline: "auto",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: alias.neutral.default,
    pointerEvents: "none",
    zIndex: 2,
});

const panel = style({
    padding: 14,
    borderRadius: alias.cornerRadius.m,
    backgroundColor: "rgba(17, 17, 17, 0.04)",
    border: "1px solid rgba(17, 17, 17, 0.15)",
});

export const heading = style({
    margin: 0,
    fontSize: 17,
    fontWeight: brand.typography.fontWeight.bold,
    lineHeight: 1.2,
});

export const cta = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    padding: "8px 18px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: "#111111",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: brand.typography.fontWeight.bold,
    textTransform: "uppercase",
    cursor: "default",
});

const amount = style({
    fontWeight: brand.typography.fontWeight.bold,
});

/** A ring, not a fill: a fill would hide the black buttons and sit under the hero photo. */
const highlight = keyframes({
    "0%": { boxShadow: "0 0 0 3px rgba(0, 67, 239, 0.45)" },
    "100%": { boxShadow: "0 0 0 3px rgba(0, 67, 239, 0)" },
});

/** Applied while a focused slot is lit; fades out once, on one repaint. */
export const highlightMs = 1600;

export const highlighted = style({
    animation: `${highlight} ${highlightMs}ms ease-out forwards`,
});

export const heroSection = style({
    display: "grid",
    gap: 8,
});

export const heroArt = style([
    panel,
    {
        position: "relative",
        display: "grid",
        alignContent: "end",
        gap: 6,
    },
]);

export const heroArtFramed = style({
    aspectRatio: "4 / 5",
});

export const heroImage = style({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: alias.cornerRadius.m,
});

export const heroTag = style({
    position: "relative",
    display: "grid",
    gap: 4,
    padding: "8px 10px",
    borderRadius: alias.cornerRadius.s,
    backgroundColor: "#ffffff",
    fontSize: 11,
});

export const heroPill = style({
    justifySelf: "start",
    padding: "2px 8px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: "rgba(17, 17, 17, 0.08)",
    fontSize: 10,
});

export const eyebrow = style({
    margin: 0,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    opacity: 0.6,
});

export const muted = style({
    margin: 0,
    fontSize: 10,
    opacity: 0.6,
});

export const rewardSection = style([panel, { display: "grid", gap: 6 }]);

export const stepsSection = style({
    display: "grid",
    gap: 8,
});

export const stepsGrid = style({
    display: "grid",
    gap: 8,
});

export const step = style([panel, { display: "grid", gap: 4 }]);

export const stepNumber = style({
    margin: 0,
    width: 22,
    height: 22,
    display: "grid",
    placeItems: "center",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: "#111111",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: brand.typography.fontWeight.bold,
});

export const stepTitle = style({
    margin: 0,
    fontSize: 12,
    fontWeight: brand.typography.fontWeight.semiBold,
});

export const winWinSection = style({
    display: "grid",
    gap: 8,
});

export const winWinCards = style({
    display: "grid",
    gap: 8,
});

export const winWinCard = style([panel, { display: "grid", gap: 4 }]);

export const winWinCardAmount = style([
    amount,
    {
        margin: 0,
        fontSize: 18,
    },
]);

export const referralSection = style([panel, { display: "grid", gap: 8 }]);

export const storeSection = style([panel, { display: "grid", gap: 8 }]);

export const storeBadges = style({
    display: "flex",
    gap: 8,
});

export const storeBadge = style({
    flex: 1,
    display: "grid",
    placeItems: "center",
    padding: "8px 4px",
    borderRadius: alias.cornerRadius.s,
    backgroundColor: "#111111",
    color: "#ffffff",
    fontSize: 10,
    fontWeight: brand.typography.fontWeight.semiBold,
    textAlign: "center",
});

export const faqSection = style({
    display: "grid",
    gap: 8,
});

export const faqItem = style([panel, { padding: "10px 12px" }]);

export const faqQuestion = style({
    fontWeight: brand.typography.fontWeight.semiBold,
    fontSize: 12,
});

export const faqAnswer = style({
    margin: "6px 0 0 0",
    fontSize: 11,
});

export const attribution = style({
    margin: 0,
    fontSize: 10,
    textAlign: "center",
    opacity: 0.6,
});
