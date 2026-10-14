import { tablet } from "@frak-labs/design-system/breakpoints";
import { vars } from "@frak-labs/design-system/theme";
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
    padding: "16px",
});

export const link = style({
    color: vars.text.action,
    textDecoration: "none",
    ":hover": { textDecoration: "underline" },
});

export const sectionBox = style({
    borderTop: `1px solid ${vars.border.subtle}`,
    paddingTop: "40px",
    scrollMarginTop: "16px",
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
    gap: "16px",
    minHeight: 0,
    overflowY: "auto",
    padding: "16px",
});

export const search = style({
    border: `1px solid ${vars.border.default}`,
    borderRadius: "6px",
    boxSizing: "border-box",
    color: vars.text.primary,
    font: "inherit",
    fontSize: "14px",
    marginTop: "4px",
    padding: "6px 8px",
    width: "100%",
});

export const categoryHeading = style({
    color: vars.text.secondary,
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    margin: "12px 0 4px",
    textTransform: "uppercase",
});

export const navLink = style([
    link,
    {
        alignItems: "center",
        borderRadius: "6px",
        display: "flex",
        fontSize: "14px",
        gap: "8px",
        justifyContent: "space-between",
        padding: "4px 8px",
        selectors: {
            '&[aria-current="page"]': {
                backgroundColor: vars.surface.secondary,
                fontWeight: 600,
            },
        },
    },
]);

export const count = style({
    backgroundColor: vars.surface.warning,
    borderRadius: "999px",
    color: vars.text.warning,
    fontSize: "12px",
    fontWeight: 600,
    minWidth: "20px",
    padding: "0 6px",
    textAlign: "center",
});

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
    gap: "8px 24px",
    padding: "8px 16px",
});

export const toolbarTitle = style({
    flexGrow: 1,
    fontSize: "16px",
    fontWeight: 600,
});

export const group = style({
    alignItems: "center",
    border: 0,
    display: "flex",
    fontSize: "13px",
    gap: "4px",
    margin: 0,
    minInlineSize: 0,
    padding: 0,
});

export const chip = style({
    background: "none",
    border: `1px solid ${vars.border.default}`,
    borderRadius: "6px",
    color: vars.text.primary,
    cursor: "pointer",
    font: "inherit",
    fontSize: "13px",
    padding: "4px 10px",
    selectors: {
        '&[aria-pressed="true"]': {
            backgroundColor: vars.surface.secondary,
            borderColor: vars.text.action,
            color: vars.text.action,
            fontWeight: 600,
        },
    },
});

export const canvas = style({
    boxSizing: "border-box",
    minHeight: 0,
    minWidth: 0,
    overflow: "auto",
    padding: "24px",
});

export const frame = style({
    border: "1px solid transparent",
    boxSizing: "border-box",
    padding: "15px",
});

export const frameFixed = style({ borderColor: vars.text.tertiary });

export const frameBg = styleVariants({
    page: {},
    card: { backgroundColor: vars.surface.background },
});

export const panel = style({
    ...chrome,
    borderTopWidth: "1px",
    fontSize: "13px",
    maxHeight: "30dvh",
    overflowY: "auto",
    padding: "8px 16px",
});

export const findingList = style({
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "8px",
});

export const kind = style({
    backgroundColor: vars.surface.muted,
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: 600,
    marginRight: "8px",
    padding: "1px 6px",
});

export const marker = style([
    kind,
    {
        backgroundColor: vars.surface.warning,
        color: vars.text.warning,
        marginRight: 0,
    },
]);
