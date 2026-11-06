import { tablet } from "@frak-labs/design-system/breakpoints";
import { toastSurfaceTop } from "@frak-labs/design-system/components/ToastSurface/styles";
import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import {
    globalFontFace,
    globalStyle,
    style,
    styleVariants,
} from "@vanilla-extract/css";
import interLatin from "../../../apps/wallet/public/fonts/inter-latin.woff2?url";
import interLatinExt from "../../../apps/wallet/public/fonts/inter-latin-ext.woff2?url";

globalFontFace("Inter", [
    {
        fontStyle: "normal",
        fontWeight: "100 900",
        fontDisplay: "swap",
        src: `url("${interLatinExt}") format("woff2")`,
        unicodeRange:
            "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
    {
        fontStyle: "normal",
        fontWeight: "100 900",
        fontDisplay: "swap",
        src: `url("${interLatin}") format("woff2")`,
        unicodeRange:
            "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
]);

// The app reset locks the body (`overflow: hidden`, centred on tablet+);
// a page of stacked sections has to scroll and start at the top. `html body`
// wins on specificity, so the chunk order of the CSS does not matter.
globalStyle("html body", {
    overflow: "auto",
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            display: "block",
            minHeight: "unset",
        },
    },
});

export const page = style({
    maxWidth: "1200px",
    marginInline: "auto",
    padding: alias.spacing.m,
});

/** The gallery's own controls get the design system's ring, not the browser's. */
const focusRing = {
    ":focus-visible": {
        outline: `2px solid ${vars.border.focus}`,
        outlineOffset: "2px",
    },
};

export const link = style({
    ...focusRing,
    color: vars.text.action,
    textDecoration: "none",
    ":hover": { textDecoration: "underline" },
});

/** Placement only: the Button draws itself. */
export const skipLink = style({
    left: alias.spacing.xs,
    position: "fixed",
    top: "-64px",
    zIndex: 1,
    ":focus": { top: alias.spacing.xs },
});

export const findingsSummary = style({
    ...focusRing,
    cursor: "pointer",
});

export const sectionBox = style({
    borderTop: `1px solid ${vars.border.subtle}`,
    paddingTop: alias.spacing.xl,
    scrollMarginTop: alias.spacing.m,
    // A worst case that overflows scrolls inside its section instead of
    // panning the whole page; the inset keeps edge focus rings unclipped.
    overflowX: "auto",
    paddingInline: alias.spacing.xxs,
    marginInline: `calc(-1 * ${alias.spacing.xxs})`,
    paddingBottom: alias.spacing.xxs,
    selectors: {
        // The rule separates sections; the first one has nothing above it.
        "&:first-child": { borderTop: "none", paddingTop: 0 },
    },
});

export const inlineFindings = style({
    fontSize: fontSize.s,
});

/** Same height the business overview cards give their charts. */
export const chartBox = style({
    height: "180px",
});

export const chartBoxTall = style({
    height: "200px",
});

const chrome = {
    backgroundColor: vars.surface.background,
    borderColor: vars.border.subtle,
    borderStyle: "solid",
    borderWidth: 0,
} as const;

export const shell = style({
    display: "grid",
    gridTemplateColumns: "240px minmax(0, 1fr)",
    height: "100dvh",
});

export const sidebar = style({
    ...chrome,
    borderRightWidth: "1px",
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    minHeight: 0,
    overflowY: "auto",
    padding: alias.spacing.m,
    // Contains HiddenVisually's absolute text, which otherwise grows the page.
    position: "relative",
});

export const categoryHeading = style({
    margin: `${alias.spacing.s} 0 ${alias.spacing.xxs}`,
});

export const navLink = style([
    link,
    {
        alignItems: "center",
        borderRadius: alias.cornerRadius.s,
        display: "flex",
        fontSize: fontSize.s,
        gap: alias.spacing.xs,
        justifyContent: "space-between",
        padding: `${alias.spacing.xxs} ${alias.spacing.xs}`,
        selectors: {
            '&[aria-current="page"]': {
                backgroundColor: vars.surface.secondary,
                fontWeight: 600,
            },
        },
    },
]);

export const main = style({
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr) auto",
    minHeight: 0,
    minWidth: 0,
});

export const toolbar = style({
    ...chrome,
    alignItems: "center",
    borderBottomWidth: "1px",
    display: "flex",
    flexWrap: "wrap",
    gap: `${alias.spacing.xs} ${alias.spacing.l}`,
    padding: `${alias.spacing.xs} ${alias.spacing.m}`,
});

export const toolbarTitle = style({
    flexGrow: 1,
});

export const group = style({
    alignItems: "center",
    display: "flex",
    gap: alias.spacing.xs,
});

export const canvas = style({
    boxSizing: "border-box",
    minHeight: 0,
    minWidth: 0,
    overflow: "auto",
    padding: alias.spacing.l,
    position: "relative",
    // The skip link's target; it is not a control, so it draws no ring.
    ":focus": { outline: "none" },
});

export const frame = style({
    border: "1px solid transparent",
    boxSizing: "border-box",
    padding: `calc(${alias.spacing.m} - 1px)`,
});

export const frameFixed = style({ borderColor: vars.text.tertiary });

export const frameBg = styleVariants({
    page: {},
    card: { backgroundColor: vars.surface.background },
});

export const panel = style({
    ...chrome,
    borderTopWidth: "1px",
    fontSize: fontSize.s,
    maxHeight: "30dvh",
    overflowY: "auto",
    padding: `${alias.spacing.xs} ${alias.spacing.m}`,
});

export const findingList = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    marginTop: alias.spacing.xs,
});

/** Placement only: the Badge draws itself. */
export const kindBadge = style({
    marginRight: alias.spacing.xs,
});

/** A phone viewport: the transform contains the sheet's `position: fixed` actions. */
export const phoneFrame = style({
    border: `1px solid ${vars.border.default}`,
    borderRadius: alias.cornerRadius.xl,
    height: "520px",
    maxWidth: "100%",
    overflowY: "auto",
    transform: "translateZ(0)",
    width: "320px",
});

export const heroImage = style({
    background: `linear-gradient(135deg, ${vars.surface.primary}, ${vars.text.success})`,
    height: "100%",
});

/** ToastSurface anchors to the nearest positioned ancestor. */
export const toastFrame = style({
    backgroundColor: vars.surface.background2,
    border: `1px solid ${vars.border.subtle}`,
    height: "96px",
    maxWidth: "100%",
    position: "relative",
    width: "360px",
});

export const toastOffset = style({
    vars: { [toastSurfaceTop]: "32px" },
});
