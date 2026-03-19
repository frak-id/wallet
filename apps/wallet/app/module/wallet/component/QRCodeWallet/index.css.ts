import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const qrCodeWalletCode = style({});

globalStyle(`${qrCodeWalletCode} > svg`, {
    display: "block",
    margin: `${alias.spacing.s} auto 0 auto`,
});

export const qrCodeWalletAddress = style({
    margin: `${alias.spacing.l} 0`,
    fontSize: fontSize.xs,
    textAlign: "center",
});

export const qrCodeWalletButton = style({
    width: "100%",
});

globalStyle(`${qrCodeWalletButton} > span`, {
    flexDirection: "row",
    justifyContent: "center",
});
