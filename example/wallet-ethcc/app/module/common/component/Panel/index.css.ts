import { style } from "@vanilla-extract/css";
import { vars } from "@/styles/theme.css";

export const panel = style({
    padding: vars.space.lg,
    borderRadius: vars.radius.lg,
    border: `1px solid ${vars.color.border}`,
    background: vars.color.surface,
    backdropFilter: "blur(8px)",
    boxShadow: vars.shadow.panel,
    selectors: {
        "& + &": {
            marginTop: vars.space.lg,
        },
    },
});
