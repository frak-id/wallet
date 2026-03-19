import { style } from "@vanilla-extract/css";
import { alias } from "@/tokens.css";

export const pendingReferralButton = style({
    marginTop: "10px",
    width: "100%",
});

export const pendingReferralSuccess = style({
    color: alias.success.default,
});
