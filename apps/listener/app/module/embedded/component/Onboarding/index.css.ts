import { style, styleVariants } from "@vanilla-extract/css";

const onboardingWrapperBase = style({
    transition: "opacity 0.8s ease",
});

export const onboardingWrapper = styleVariants({
    visible: [onboardingWrapperBase, { opacity: 1 }],
    hidden: [onboardingWrapperBase, { opacity: 0 }],
});

const onboardingBase = style({
    position: "absolute",
    width: "250px",
    padding: "6px 6px 6px 12px",
    borderRadius: "11px",
    background: "#ffffff2b",
    backdropFilter: "blur(13px)",
    textAlign: "left",
    fontSize: "12px",
    lineHeight: "18px",
    color: "#000000",
    selectors: {
        "&::after": {
            position: "absolute",
            bottom: "-13px",
            left: "15px",
            width: "14px",
            height: "13px",
            content:
                'url("data:image/svg+xml;base64,PHN2ZyBmaWxsPSJub25lIiBoZWlnaHQ9IjEzIiB2aWV3Qm94PSIwIDAgMTQgMTMiIHdpZHRoPSIxNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJtMTQgMGgtMTRzMyAxIDIgNS41LTIgNy0yIDcgNS41LTEuNSA5LjUtNS41IDQuNS03IDQuNS03eiIgZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIuMTciLz48L3N2Zz4=")',
        },
    },
});

export const onboarding = styleVariants({
    default: [onboardingBase, {}],
    reverse: [
        onboardingBase,
        {
            selectors: {
                "&::after": {
                    bottom: "auto",
                    top: "-13px",
                    left: "auto",
                    right: "20px",
                    transform: "rotate(175deg)",
                },
            },
        },
    ],
});

export const onboarding__arrow = style({
    position: "absolute",
});
