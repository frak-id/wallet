import { styleVariants } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

const base = {
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.secondary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.icon.tertiary,
    flexShrink: 0,
} as const;

export const iconCircleSizes = styleVariants({
    sm: { ...base, width: "32px", height: "32px" },
    md: { ...base, width: "48px", height: "48px" },
    lg: { ...base, width: "56px", height: "56px" },
});
