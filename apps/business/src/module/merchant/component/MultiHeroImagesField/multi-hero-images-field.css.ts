import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { focusRing, interactive } from "@/module/common/styles/interaction.css";

// Two columns on the edit card, one on a phone; every row as tall as an image tile.
export const grid = style({
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gridAutoRows: "1fr",
    gap: alias.spacing.s,
});

export const addItem = style({
    display: "flex",
});

export const addTile = style({
    display: "flex",
    flex: 1,
});

export const addButton = style([
    interactive,
    focusRing,
    {
        all: "unset",
        boxSizing: "border-box",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: alias.spacing.xs,
        padding: alias.spacing.m,
        borderRadius: alias.cornerRadius.m,
        border: `1px dashed ${vars.border.default}`,
        backgroundColor: vars.surface.muted,
        cursor: "pointer",
        selectors: {
            "&:not(:disabled):hover, &[data-active]": {
                borderColor: vars.border.focus,
                backgroundColor: vars.surface.secondary,
            },
            "&:disabled": { cursor: "default" },
        },
    },
]);
