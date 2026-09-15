import type { CSSProperties } from "react";
import type { ButtonShareStyleValues, StyleTier } from "../types";

const MARKER_OPEN = "/* frak:style ";
const MARKER_CLOSE = "/* /frak:style */";
const COMMENT_END = "*/";

export const DEFAULT_TIER = "default";
export const TRANSPARENT = "transparent";

const HEX_COLOR = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const COLOR_KEYS = ["bg", "fg", "bc"] as const;
const NUMERIC_KEYS = ["bw", "fs", "py", "px", "mt", "mb", "ml", "mr"] as const;

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

/**
 * Keeps only entries the codec can emit safely. Anything else is dropped, so a
 * serialized marker can never contain a comment terminator.
 */
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
    const push = (property: string, value: string) =>
        declarations.push(`${property}:${value}!important`);

    if (values.bg !== undefined) push("background", values.bg);
    if (values.fg !== undefined) push("color", values.fg);
    if (values.bw !== undefined) {
        push("border-style", "solid");
        push("border-width", `${values.bw}px`);
    }
    if (values.bc !== undefined) push("border-color", values.bc);
    if (values.fs !== undefined) push("font-size", `${values.fs}px`);
    if (values.py !== undefined) {
        push("padding-top", `${values.py}px`);
        push("padding-bottom", `${values.py}px`);
    }
    if (values.px !== undefined) {
        push("padding-left", `${values.px}px`);
        push("padding-right", `${values.px}px`);
    }
    if (values.mt !== undefined) push("margin-top", `${values.mt}px`);
    if (values.mb !== undefined) push("margin-bottom", `${values.mb}px`);
    if (values.ml !== undefined) push("margin-left", `${values.ml}px`);
    if (values.mr !== undefined) push("margin-right", `${values.mr}px`);

    return declarations.join(";");
}

/**
 * Emits foreign CSS first and the block last, so an equally-specific stored
 * rule loses to the dashboard on source order. The default tier self-scopes
 * because the backend serves it unwrapped.
 */
export function serializeStyleCss(
    values: ButtonShareStyleValues,
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
    values: ButtonShareStyleValues
): CSSProperties {
    const safeValues = normalizeValues(values);
    return {
        ...(safeValues.bg !== undefined && { background: safeValues.bg }),
        ...(safeValues.fg !== undefined && { color: safeValues.fg }),
        ...(safeValues.bw !== undefined && {
            borderStyle: "solid",
            borderWidth: `${safeValues.bw}px`,
        }),
        ...(safeValues.bc !== undefined && { borderColor: safeValues.bc }),
        ...(safeValues.fs !== undefined && {
            fontSize: `${safeValues.fs}px`,
        }),
        ...(safeValues.py !== undefined && {
            paddingTop: `${safeValues.py}px`,
            paddingBottom: `${safeValues.py}px`,
        }),
        ...(safeValues.px !== undefined && {
            paddingLeft: `${safeValues.px}px`,
            paddingRight: `${safeValues.px}px`,
        }),
        ...(safeValues.mt !== undefined && {
            marginTop: `${safeValues.mt}px`,
        }),
        ...(safeValues.mb !== undefined && {
            marginBottom: `${safeValues.mb}px`,
        }),
        ...(safeValues.ml !== undefined && {
            marginLeft: `${safeValues.ml}px`,
        }),
        ...(safeValues.mr !== undefined && {
            marginRight: `${safeValues.mr}px`,
        }),
    };
}
