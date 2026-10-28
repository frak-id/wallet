import { alias, brand } from "@frak-labs/design-system/tokens";
import { keyframes, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

const { white } = brand.colors.neutral;

const pop = keyframes({
    "0%": { opacity: 0, transform: "scale(0.6) translateY(6px)" },
    "60%": { opacity: 1, transform: "scale(1.08)" },
    "100%": { opacity: 1, transform: "scale(1)" },
});

const slideIn = keyframes({
    from: { opacity: 0, transform: "translateY(-8px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

const fadeOut = keyframes({
    from: { opacity: 1 },
    to: { opacity: 0 },
});

const desaturate = keyframes({
    from: { filter: "grayscale(1) brightness(0.85)" },
    to: { filter: "grayscale(0) brightness(1)" },
});

const lockOut = keyframes({
    "0%": { opacity: 1, transform: "scale(1)" },
    "40%": { opacity: 1, transform: "scale(1.2) rotate(-12deg)" },
    "100%": { opacity: 0, transform: "scale(0.4) rotate(20deg)" },
});

/** Without motion the animation's end state shows at once; `end` restates it where it is not the default. */
const still = (end: { opacity?: number } = {}) => ({
    "@media": {
        "(prefers-reduced-motion: reduce)": { animation: "none", ...end },
    },
});

const notch = (radius: number) =>
    `radial-gradient(circle at 0 50%, transparent ${radius}px, #000 ${radius + 0.5}px) left / 51% 100% no-repeat, radial-gradient(circle at 100% 50%, transparent ${radius}px, #000 ${radius + 0.5}px) right / 51% 100% no-repeat`;

const lockedGradient = `radial-gradient(120% 90% at 50% 0%, ${brand.colors.neutral.grey500}, ${brand.colors.neutral.grey700})`;

export const hero = style({
    position: "relative",
    overflow: "hidden",
    borderRadius: alias.cornerRadius.xl,
    padding: alias.spacing.l,
    color: white,
    background: `radial-gradient(120% 90% at 50% 0%, ${brand.colors.primary[400]}, ${brand.colors.primary[700]})`,
    textAlign: "center",
});

export const lockedLayer = recipe({
    base: {
        position: "absolute",
        inset: 0,
        background: lockedGradient,
    },
    variants: {
        out: {
            true: {
                animation: `${fadeOut} 0.7s 0.45s ease-out both`,
                ...still({ opacity: 0 }),
            },
        },
    },
});

/** Above the locked layer. */
export const content = style({ position: "relative" });

export const deck = style({
    position: "relative",
    width: 150,
    height: 92,
});

export const card = recipe({
    base: {
        position: "absolute",
        left: 25,
        top: 14,
        width: 100,
        height: 62,
        borderRadius: 10,
        background: `linear-gradient(135deg, ${white}, ${brand.colors.primary[100]})`,
        boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
        mask: notch(9),
        WebkitMask: notch(9),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: brand.colors.primary[700],
        fontWeight: 800,
        fontSize: 30,
    },
    variants: {
        position: {
            front: {},
            left: { transform: "rotate(-12deg) translateX(-18px)" },
            right: { transform: "rotate(8deg) translateX(16px)" },
        },
        locked: {
            true: {
                background: `linear-gradient(135deg, ${brand.colors.neutral.grey250}, ${brand.colors.neutral.grey400})`,
                color: brand.colors.neutral.grey700,
            },
        },
        pop: {
            true: {
                animation: `${pop} 0.5s cubic-bezier(0.23, 1, 0.32, 1) both`,
                ...still(),
            },
        },
        // After `pop`: the unlock sweep wins on the front card.
        unlocking: {
            true: {
                animation: `${desaturate} 0.7s 0.45s ease-out both`,
                ...still(),
            },
        },
    },
});

export const padlock = recipe({
    base: {
        position: "absolute",
        right: 4,
        top: 0,
        width: 36,
        height: 36,
        borderRadius: alias.cornerRadius.full,
        background: white,
        color: brand.colors.neutral.grey700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    },
    variants: {
        out: {
            true: {
                animation: `${lockOut} 0.5s 0.1s ease-in both`,
                ...still({ opacity: 0 }),
            },
        },
    },
});

export const gainBadge = style({
    position: "absolute",
    right: -6,
    top: -4,
    padding: "4px 10px",
    borderRadius: alias.cornerRadius.full,
    background: brand.colors.success[800],
    color: white,
    fontWeight: 800,
    fontSize: 15,
    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
    animation: `${pop} 0.5s 0.2s cubic-bezier(0.23, 1, 0.32, 1) both`,
    ...still(),
});

export const gains = style({
    padding: "6px 12px",
    borderRadius: alias.cornerRadius.m,
    background: brand.colors.success[100],
    color: brand.colors.success[800],
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.4,
    animation: `${slideIn} 0.35s 0.35s ease-out both`,
    ...still(),
});

export const countdown = recipe({
    base: {
        padding: "4px 12px",
        borderRadius: alias.cornerRadius.full,
        background: "rgba(0,0,0,0.25)",
        fontSize: 13,
        fontWeight: 600,
    },
    variants: {
        urgent: {
            true: {
                background: brand.colors.warning[500],
                color: brand.colors.neutral.grey700,
            },
        },
    },
});

export const endsAt = style({ marginTop: -6 });
