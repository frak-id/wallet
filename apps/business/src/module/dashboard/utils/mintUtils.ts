import type { Stablecoin } from "@frak-labs/app-essentials";

export function getDefaultStablecoin(): Stablecoin {
    if (typeof navigator === "undefined") return "eure";

    const language = navigator.language.toLowerCase();
    if (language.startsWith("en-us")) return "usde";
    if (language.startsWith("en-gb")) return "gbpe";
    return "eure";
}
