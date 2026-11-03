import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const mono = style({
    fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontVariantNumeric: "tabular-nums",
});

export const codeCell = style([mono, { fontWeight: 600, letterSpacing: 1 }]);

export const formGrid = style({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: alias.spacing.m,
    alignItems: "end",
});

export const twoColumns = style({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: alias.spacing.m,
    alignItems: "start",
});

/** The `qr` SVG has a viewBox and no size: the component makes it fill this square. */
export const qrFrame = style({
    boxSizing: "border-box",
    width: 220,
    maxWidth: "100%",
    aspectRatio: "1 / 1",
    padding: alias.spacing.s,
    background: "#fff",
    borderRadius: alias.cornerRadius.m,
    border: `1px solid ${vars.border.subtle}`,
});

export const qrDialog = style({
    maxWidth: 360,
});

export const linkButton = style({
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    color: vars.text.action,
    textAlign: "left",
    font: "inherit",
});

export const sourceBar = style({
    display: "flex",
    height: 10,
    width: "100%",
    overflow: "hidden",
    borderRadius: alias.cornerRadius.s,
    background: vars.surface.muted,
});

export const payload = style([
    mono,
    {
        maxWidth: 360,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        fontSize: 12,
        color: vars.text.secondary,
    },
]);
