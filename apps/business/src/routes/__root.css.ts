import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const errorContainer = style({
    padding: "2rem",
    textAlign: "center",
    maxWidth: "600px",
    margin: "4rem auto",
});

export const errorContainerTitle = style({
    marginBottom: "1rem",
});

export const errorContainerMessage = style({
    marginBottom: "1rem",
});

export const errorContainerStack = style({
    textAlign: "left",
    overflow: "auto",
    padding: "1rem",
    background: vars.surface.muted,
    borderRadius: alias.cornerRadius.s,
    fontSize: "0.75rem",
});
