import type { ButtonShareStyleValues } from "../types";
import { COLOR_KEYS, TRANSPARENT } from "./styleCodec";

export const LOOKS = ["theme", "solid", "outline"] as const;
export type Look = (typeof LOOKS)[number];
export type LookChoice = Look | "custom";

export const SIZE_STEPS = ["s", "m", "l"] as const;
export type SizeStep = (typeof SIZE_STEPS)[number];
export type SizeChoice = SizeStep | "custom";

export const DEFAULT_ACCENT = "#1e1e1e";
export const DEFAULT_SIZE: SizeStep = "m";

const SIZE_SCALE: Record<SizeStep, { fs: number; py: number; px: number }> = {
    s: { fs: 13, py: 8, px: 14 },
    m: { fs: 15, py: 12, px: 20 },
    l: { fs: 17, py: 15, px: 26 },
};

export function fontSizeFor(size: SizeStep): number {
    return SIZE_SCALE[size].fs;
}

// A look is identified by its colour/border signature alone: padding and
// margin stay editable in the box model without dropping out of the preset.
const LOOK_KEYS = [...COLOR_KEYS, "bw"] as const;

/** Six-digit body of any accepted hex form, or undefined when unparsable. */
function hexBody(hex: string): string | undefined {
    const body = hex.startsWith("#") ? hex.slice(1) : "";
    if (body.length === 3 || body.length === 4) {
        return body
            .slice(0, 3)
            .split("")
            .map((char) => char + char)
            .join("");
    }
    if (body.length === 6 || body.length === 8) return body.slice(0, 6);
    return undefined;
}

function channel(body: string, index: number): number {
    const raw = Number.parseInt(body.slice(index * 2, index * 2 + 2), 16) / 255;
    return raw <= 0.04045 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
}

function luminance(body: string): number {
    return (
        0.2126 * channel(body, 0) +
        0.7152 * channel(body, 1) +
        0.0722 * channel(body, 2)
    );
}

const DARK_FG = "#111111";
const LIGHT_FG = "#ffffff";
const DARK_FG_LUMINANCE = luminance("111111");
const LIGHT_FG_LUMINANCE = 1;

function contrast(a: number, b: number): number {
    return a > b ? (a + 0.05) / (b + 0.05) : (b + 0.05) / (a + 0.05);
}

/**
 * Foreground with the better WCAG contrast against `accent`. Comparing both
 * candidates rather than thresholding a luminance: the crossover sits near
 * 0.19, so any mid-tone accent picks white and fails AA.
 */
export function readableOn(accent: string): string {
    const body = hexBody(accent);
    if (!body) return LIGHT_FG;
    const background = luminance(body);
    return contrast(background, DARK_FG_LUMINANCE) >=
        contrast(background, LIGHT_FG_LUMINANCE)
        ? DARK_FG
        : LIGHT_FG;
}

export function buildLook(
    look: Look,
    size: SizeStep,
    accent: string
): ButtonShareStyleValues {
    if (look === "theme") return {};
    const scale = SIZE_SCALE[size];
    const base = { fs: scale.fs, py: scale.py, px: scale.px };

    switch (look) {
        case "solid":
            return { ...base, bg: accent, fg: readableOn(accent), bw: 0 };
        case "outline":
            return {
                ...base,
                bg: TRANSPARENT,
                fg: accent,
                bc: accent,
                bw: 1,
            };
    }
}

/** Cleared controls hold `""`; presets omit the key. Both mean "unset". */
function unset(value: unknown): unknown {
    return value === "" || value === null ? undefined : value;
}

function sameLook(
    candidate: ButtonShareStyleValues,
    values: ButtonShareStyleValues
): boolean {
    return LOOK_KEYS.every(
        (key) => unset(candidate[key]) === unset(values[key])
    );
}

function matchSize(values: ButtonShareStyleValues): SizeChoice {
    const step = SIZE_STEPS.find((size) => SIZE_SCALE[size].fs === values.fs);
    return step ?? "custom";
}

function accentFor(
    look: Look,
    values: ButtonShareStyleValues
): string | undefined {
    const raw = look === "solid" ? values.bg : values.fg;
    return raw && raw !== TRANSPARENT ? raw : undefined;
}

function isUnstyled(values: ButtonShareStyleValues): boolean {
    return LOOK_KEYS.every((key) => unset(values[key]) === undefined);
}

export type LookMatch = {
    look: LookChoice;
    size: SizeChoice;
    accent: string;
};

/**
 * Reads the selected look straight off the stored values, so the controls can
 * stay stateless and never drift from what the codec will emit.
 */
export function matchLook(values: ButtonShareStyleValues): LookMatch {
    const size = matchSize(values);

    if (isUnstyled(values)) {
        return { look: "theme", size, accent: DEFAULT_ACCENT };
    }

    for (const look of LOOKS) {
        if (look === "theme") continue;
        const accent = accentFor(look, values);
        if (!accent) continue;
        if (sameLook(buildLook(look, DEFAULT_SIZE, accent), values)) {
            return { look, size, accent };
        }
    }

    return {
        look: "custom",
        size,
        accent: accentFor("outline", values) ?? DEFAULT_ACCENT,
    };
}

/** Applies a preset over the current values, preserving spacing and weight. */
export function applyLook(
    values: ButtonShareStyleValues,
    look: Look,
    size: SizeStep,
    accent: string
): ButtonShareStyleValues {
    const { mt, mb, ml, mr, mu, fw } = values;
    return { ...buildLook(look, size, accent), mt, mb, ml, mr, mu, fw };
}
