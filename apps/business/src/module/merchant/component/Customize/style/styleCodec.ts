import type { CSSProperties } from "react";
import type {
    ButtonShareStyleFormValues,
    ButtonShareStyleValues,
    FontWeight,
    SpacingUnit,
    StyleTier,
    TextTransform,
} from "../types";
import { FONT_WEIGHTS, SPACING_UNITS, TEXT_TRANSFORMS } from "../types";

const MARKER_OPEN = "/* frak:style ";
const MARKER_CLOSE = "/* /frak:style */";
const COMMENT_END = "*/";

export const DEFAULT_TIER = "default";
export const TRANSPARENT = "transparent";

const HEX_COLOR = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export const COLOR_KEYS = ["bg", "fg", "bc"] as const;
export const PADDING_KEYS = ["py", "px"] as const;
export const MARGIN_KEYS = ["mt", "mb", "ml", "mr"] as const;
const NUMERIC_KEYS = ["bw", "fs", ...PADDING_KEYS, ...MARGIN_KEYS] as const;
const UNIT_KEYS = ["pu", "mu"] as const;

export type ColorKey = (typeof COLOR_KEYS)[number];
export type PaddingKey = (typeof PADDING_KEYS)[number];
export type MarginKey = (typeof MARGIN_KEYS)[number];

const DEFAULT_UNIT: SpacingUnit = "px";

type EmittedEntry = {
    key: keyof ButtonShareStyleValues;
    unit?: "pu" | "mu";
    /** Numeric CSS that takes no length unit, e.g. `font-weight`. */
    unitless?: boolean;
    css: readonly (readonly [string, string])[];
};

// One table drives both emitters below, so a property can never reach the
// served CSS without also reaching the dashboard preview.
const EMITTED: readonly EmittedEntry[] = [
    { key: "bg", css: [["background", "background"]] },
    { key: "fg", css: [["color", "color"]] },
    {
        key: "bw",
        css: [
            ["border-style", "borderStyle"],
            ["border-width", "borderWidth"],
        ],
    },
    { key: "bc", css: [["border-color", "borderColor"]] },
    { key: "fs", css: [["font-size", "fontSize"]] },
    { key: "fw", unitless: true, css: [["font-weight", "fontWeight"]] },
    { key: "tt", css: [["text-transform", "textTransform"]] },
    {
        key: "py",
        unit: "pu",
        css: [
            ["padding-top", "paddingTop"],
            ["padding-bottom", "paddingBottom"],
        ],
    },
    {
        key: "px",
        unit: "pu",
        css: [
            ["padding-left", "paddingLeft"],
            ["padding-right", "paddingRight"],
        ],
    },
    { key: "mt", unit: "mu", css: [["margin-top", "marginTop"]] },
    { key: "mb", unit: "mu", css: [["margin-bottom", "marginBottom"]] },
    { key: "ml", unit: "mu", css: [["margin-left", "marginLeft"]] },
    { key: "mr", unit: "mu", css: [["margin-right", "marginRight"]] },
];

/** `border-width` needs its companion `border-style` before it takes effect. */
const IMPLIED: Partial<Record<keyof ButtonShareStyleValues, string>> = {
    bw: "solid",
};

function renderedValue(
    values: ButtonShareStyleValues,
    entry: EmittedEntry,
    property: string
): string | undefined {
    const raw = values[entry.key];
    if (raw === undefined) return undefined;
    if (IMPLIED[entry.key] && property.endsWith("style")) {
        return IMPLIED[entry.key];
    }
    if (typeof raw !== "number") return raw;
    if (entry.unitless) return String(raw);
    const unit = entry.unit ? (values[entry.unit] ?? DEFAULT_UNIT) : "px";
    return `${raw}${unit}`;
}

export type ParsedStyle = {
    values: ButtonShareStyleValues;
    foreignCss: string;
};

export function isHexColor(value: string): boolean {
    return HEX_COLOR.test(value);
}

function isColor(value: unknown, allowTransparent: boolean): value is string {
    if (typeof value !== "string") return false;
    if (allowTransparent && value === TRANSPARENT) return true;
    return HEX_COLOR.test(value);
}

function isSize(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isUnit(value: unknown): value is SpacingUnit {
    return SPACING_UNITS.includes(value as SpacingUnit);
}

function isFontWeight(value: unknown): value is FontWeight {
    return FONT_WEIGHTS.includes(value as FontWeight);
}

function isTextTransform(value: unknown): value is TextTransform {
    return TEXT_TRANSFORMS.includes(value as TextTransform);
}

/**
 * Keeps only entries the codec can emit safely. Anything else is dropped, so a
 * serialized marker can never contain a comment terminator.
 */
export function normalizeStyleValues(input: unknown): ButtonShareStyleValues {
    return normalizeValues(input);
}

function normalizeValues(input: unknown): ButtonShareStyleValues {
    if (typeof input !== "object" || input === null) return {};
    const source = input as Record<string, unknown>;
    const values: ButtonShareStyleValues = {};

    for (const key of COLOR_KEYS) {
        const value = source[key];
        if (isColor(value, key === "bg")) values[key] = value;
    }
    for (const key of NUMERIC_KEYS) {
        const value = source[key];
        if (isSize(value)) values[key] = value;
    }

    if (isFontWeight(source.fw)) values.fw = source.fw;
    if (isTextTransform(source.tt)) values.tt = source.tt;

    // A unit only decorates sizes, so an orphan one is dropped rather than
    // stored as a styled state that emits nothing.
    for (const key of UNIT_KEYS) {
        const value = source[key];
        const group = key === "pu" ? PADDING_KEYS : MARGIN_KEYS;
        const hasSize = group.some((sizeKey) => values[sizeKey] !== undefined);
        if (isUnit(value) && hasSize) values[key] = value;
    }

    return values;
}

function parsePayload(json: string): ButtonShareStyleValues | undefined {
    try {
        return normalizeValues(JSON.parse(json));
    } catch {
        return undefined;
    }
}

/**
 * Splits stored `rawCss` into the block's values and the CSS it does not own.
 * An absent, malformed or unterminated marker yields empty values and leaves
 * the whole string foreign, so no merchant CSS is ever discarded.
 * Scanning from the last marker keeps a damaged earlier block from swallowing
 * the one written most recently.
 */
export function parseStyleCss(rawCss: string | undefined | null): ParsedStyle {
    const source = rawCss ?? "";
    const foreignOnly: ParsedStyle = { values: {}, foreignCss: source.trim() };

    const open = source.lastIndexOf(MARKER_OPEN);
    if (open === -1) return foreignOnly;

    const payloadStart = open + MARKER_OPEN.length;
    const payloadEnd = source.indexOf(COMMENT_END, payloadStart);
    if (payloadEnd === -1) return foreignOnly;

    const close = source.indexOf(MARKER_CLOSE, payloadEnd);
    if (close === -1) return foreignOnly;

    const values = parsePayload(source.slice(payloadStart, payloadEnd));
    if (!values) return foreignOnly;

    const before = source.slice(0, open);
    const after = source.slice(close + MARKER_CLOSE.length);
    return { values, foreignCss: `${before}\n${after}`.trim() };
}

function toDeclarations(values: ButtonShareStyleValues): string {
    const declarations: string[] = [];

    for (const entry of EMITTED) {
        for (const [property] of entry.css) {
            const value = renderedValue(values, entry, property);
            if (value !== undefined) {
                declarations.push(`${property}:${value}!important`);
            }
        }
    }

    return declarations.join(";");
}

/**
 * Emits foreign CSS first and the block last, so an equally-specific stored
 * rule loses to the dashboard on source order. The default tier self-scopes
 * because the backend serves it unwrapped.
 */
export function serializeStyleCss(
    values: ButtonShareStyleFormValues,
    foreignCss: string,
    tier: StyleTier
): string | undefined {
    const safeValues = normalizeValues(values);
    const declarations = toDeclarations(safeValues);
    const foreign = foreignCss.trim();

    if (!declarations) return foreign || undefined;

    const selector =
        tier === DEFAULT_TIER ? "frak-button-share .button" : ".button";
    const block = `${MARKER_OPEN}${JSON.stringify(safeValues)} ${COMMENT_END}\n${selector}{${declarations}}\n${MARKER_CLOSE}`;

    return foreign ? `${foreign}\n${block}` : block;
}

/** Same properties the serializer emits, for the dashboard preview. */
export function styleValuesToCssProperties(
    values: ButtonShareStyleFormValues
): CSSProperties {
    const safeValues = normalizeValues(values);
    const properties: Record<string, string> = {};

    for (const entry of EMITTED) {
        for (const [property, camel] of entry.css) {
            const value = renderedValue(safeValues, entry, property);
            if (value !== undefined) properties[camel] = value;
        }
    }

    return properties;
}
