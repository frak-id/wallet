import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";
import { alias, safeArea, zIndex } from "../../tokens.css";

export const containerStyle = recipe({
    base: {
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        paddingTop: safeArea.top,
        "@media": {
            "screen and (min-width: 1024px)": {
                minHeight: "auto",
                paddingTop: 0,
                backgroundColor: vars.surface.background,
            },
        },
    },
    variants: {
        /** `background2` lets white elevated cards stand out on the sheet. */
        surface: {
            background: {},
            background2: {
                backgroundColor: vars.surface.background2,
                "@media": {
                    "screen and (min-width: 1024px)": {
                        backgroundColor: vars.surface.background2,
                    },
                },
            },
        },
    },
    defaultVariants: {
        surface: "background",
    },
});

export const heroStyle = recipe({
    base: {
        position: "relative",
        flexShrink: 0,
        overflow: "hidden",
        height: "var(--detail-sheet-hero-height, 350px)",
    },
    variants: {
        /** `overlay` tints a hero that carries no image, up under the status bar. */
        surface: {
            none: {},
            overlay: {
                backgroundColor: vars.surface.overlay,
                marginTop: `calc(-1 * ${safeArea.top})`,
                height: `calc(var(--detail-sheet-hero-height, 350px) + ${safeArea.top})`,
                "@media": {
                    "screen and (min-width: 1024px)": {
                        marginTop: 0,
                        height: "var(--detail-sheet-hero-height, 350px)",
                    },
                },
            },
        },
    },
    defaultVariants: {
        surface: "none",
    },
});

export const actionsStyle = style({
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: `max(${alias.spacing.m}, ${safeArea.top})`,
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.m,
    zIndex: zIndex.modal,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    "@media": {
        "screen and (min-width: 1024px)": {
            position: "absolute",
            paddingTop: alias.spacing.m,
        },
    },
});

export const bodyStyle = style({
    position: "relative",
    zIndex: 1,
    marginTop: `calc(-1 * ${alias.cornerRadius.xl})`,
    borderRadius: `${alias.cornerRadius.xl} ${alias.cornerRadius.xl} 0 0`,
    backgroundColor: vars.surface.background2,
    padding: `${alias.spacing.l} ${alias.spacing.m}`,
    flex: 1,
});

export const footerStyle = style({
    position: "sticky",
    bottom: 0,
    zIndex: 2,
    flexShrink: 0,
    padding: `${alias.spacing.m}`,
    paddingBottom: `max(${alias.spacing.xl}, ${safeArea.bottom})`,
    backgroundColor: vars.surface.background2,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.m,
});
