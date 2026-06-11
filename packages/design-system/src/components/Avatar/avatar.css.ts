import { styleVariants } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias, brand, fontSize } from "../../tokens.css";

const base = {
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.secondary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.text.action,
    fontSize: fontSize.s,
    lineHeight: "22px",
    fontWeight: brand.typography.fontWeight.medium,
    flexShrink: 0,
    userSelect: "none",
} as const;

export const avatarSizes = styleVariants({
    s: { ...base, width: "32px", height: "32px" },
    m: { ...base, width: "40px", height: "40px" },
});
