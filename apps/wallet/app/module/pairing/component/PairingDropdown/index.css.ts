import { brand } from "@frak-labs/design-system/tokens";
import { keyframes, style } from "@vanilla-extract/css";

const slideIn = keyframes({
    from: {
        opacity: 0,
        transform: "translateY(-20px)",
    },
    to: {
        opacity: 1,
        transform: "translateY(0)",
    },
});

export const pairingDropdown = style({
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    zIndex: 10,
    display: "flex",
    flexDirection: "column",
    margin: `0 ${brand.scale[300]}`,
    gap: brand.scale[300],
    animation: `${slideIn} 0.3s ease-out forwards`,
});
