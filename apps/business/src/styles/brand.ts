/**
 * Brand-unique colors and gradients not covered by @frak-labs/design-system tokens.
 * Consumers should import from "@frak-labs/design-system/tokens" or
 * "@frak-labs/design-system/theme" for everything else.
 */
export const brandColors = {
    turquoise: "#02e6d5",
    turquoise20: "#184b67",
    turquoiseDark20: "#213937",
    neonGreen: "#00e617",
    accent: "#00baf1",
    accentTransition: "rgba(246, 55, 237, 0)",
    chartreuseYellow: "#ebff00",
    cerulean: "#13b2e4",
    darkNavy: "#001432",
    blueZodiac: "#123365",
    blueZodiacDarker: "#12244b",
    blueCharcoal: "#000b1c",
    blueFrak: "#03193a",
    greenFrak: "#00e6d4",
    blueLightFrak: "#00baf1",
    blueBackground: "#001432",
    tangaroa: "#041a3b",
    tundora: "#474747",
    mineShaft: "#1f1f1f",
    mineShaftLighter: "#333333",
    silverChalice: "#adadad",
    alto: "#d9d9d9",
    grayInput: "#9b9b9b",
    blumine: "#1b697e",
    eastBay: "#3f5279",
    mystic: "#e2ebef",
    mystic2: "#ebf0f2",
    redDark34: "#65253b",
    shadow: "#00000040",
    blur: "rgba(245, 245, 245, 0.1)",
} as const;

export const brandGradients = {
    primary:
        "linear-gradient(55deg, #8b5eb3 11.39%, #b155b3 13.1%, #b13fb3 17.35%, #b12fb3 21.61%, #b125b3 27.57%, #b123b3 34.39%, #6e5cca 45.46%, #338ede 56.53%, #0faeeb 65.04%, #02baf0 69.3%, #02e6d5 86.33%)",
    blue: "radial-gradient(297.34% 103.75% at 0% 91.53%, #00246a 0%, #436dc4 52.26%, #ffffff 98.85%)",
} as const;

export const brandBackgrounds = {
    dark: 'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUxOSIgaGVpZ2h0PSIxMDg3IiB2aWV3Qm94PSIwIDAgMTUxOSAxMDg3IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTUxOSIgaGVpZ2h0PSIxMDg3IiBmaWxsPSJ1cmwoI3BhaW50MF9yYWRpYWxfOTg2MF8yNjc0KSIvPgo8ZGVmcz4KPHJhZGlhbEdyYWRpZW50IGlkPSJwYWludDBfcmFkaWFsXzk4NjBfMjY3NCIgY3g9IjAiIGN5PSIwIiByPSIxIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgZ3JhZGllbnRUcmFuc2Zvcm09InRyYW5zbGF0ZSgzOTAuMzQ4IDQ5Mi4xMjQpIHJvdGF0ZSgyMC4yODMxKSBzY2FsZSgxNDQ0LjMgNDI3LjYzNykiPgo8c3RvcCBzdG9wLWNvbG9yPSIjMTk0MzgwIi8+CjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzAzMTkzQSIvPgo8L3JhZGlhbEdyYWRpZW50Pgo8L2RlZnM+Cjwvc3ZnPgo=")',
} as const;
