import type { CSSProperties } from "react";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function luminance(hex: string): number {
    const channel = (at: number) => {
        const s = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Black or white, whichever reads better on `hex`; the pick `<frak-ambassador>` makes. */
export function accentInk(hex: string): "#000" | "#fff" {
    const lum = luminance(hex) + 0.05;
    const againstWhite = 1.05 / lum;
    const againstBlack = lum / 0.05;
    return againstBlack > againstWhite ? "#000" : "#fff";
}

/** The two knobs the page's buttons read; `undefined` leaves the stylesheet default. */
export function accentVars(hex: string | undefined): CSSProperties | undefined {
    if (!hex || !HEX_COLOR.test(hex)) return undefined;
    return {
        "--frak-amb-accent": hex,
        "--frak-amb-accent-ink": accentInk(hex),
    } as CSSProperties;
}
