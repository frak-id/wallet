import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const BLOCKS_DIR = resolve(__dirname, "../extensions/theme-components/blocks");

// Literals generated into listener.liquid by scripts/stageArtifacts.ts, never merchant input.
const STAGE_CONSTANTS = new Set(["frak_sdk_origin", "frak_sdk_fallback_tag"]);

type Finding = { line: number; expression: string; fix: string };

function blank(source: string, pattern: RegExp): string {
    return source.replace(pattern, (match) => match.replace(/[^\n]/g, " "));
}

function ranges(source: string, pattern: RegExp): [number, number][] {
    return [...source.matchAll(pattern)].map((m) => [
        m.index,
        m.index + m[0].length,
    ]);
}

export function unescapedOutputs(source: string): Finding[] {
    let text = blank(
        source,
        /{%-?\s*schema\s*-?%}[\s\S]*?{%-?\s*endschema\s*-?%}/g
    );
    text = blank(
        text,
        /{%-?\s*comment\s*-?%}[\s\S]*?{%-?\s*endcomment\s*-?%}/g
    );
    const scripts = ranges(text, /<script\b[\s\S]*?<\/script>/g);
    const styles = ranges(
        text,
        /{%-?\s*style\s*-?%}[\s\S]*?{%-?\s*endstyle\s*-?%}/g
    );
    const inside = (index: number, spans: [number, number][]) =>
        spans.some(([start, end]) => index >= start && index < end);

    const findings: Finding[] = [];
    for (const match of text.matchAll(/{{-?\s*([\s\S]*?)\s*-?}}/g)) {
        const expression = match[1];
        const [base, ...filterParts] = expression
            .split("|")
            .map((p) => p.trim());
        const lastFilter = filterParts.at(-1)?.split(/[\s:]/)[0];
        const line = text.slice(0, match.index).split("\n").length;

        if (STAGE_CONSTANTS.has(base) && filterParts.length === 0) continue;
        if (
            inside(match.index, styles) &&
            /^block\.settings\.\w+_color$/.test(base) &&
            filterParts.length === 0
        ) {
            continue;
        }
        if (inside(match.index, scripts)) {
            if (lastFilter !== "json") {
                findings.push({
                    line,
                    expression,
                    fix: "inside <script>: end with `| json` and remove the quotes around the output",
                });
            }
            continue;
        }
        if (lastFilter !== "escape") {
            findings.push({
                line,
                expression,
                fix: "in HTML: end with `| escape`",
            });
        }
    }
    return findings;
}

const BLOCK_FILES = readdirSync(BLOCKS_DIR).filter((f) =>
    f.endsWith(".liquid")
);

describe("theme block output escaping", () => {
    it("flags raw outputs in a script and in an attribute", () => {
        const sample = [
            '<div title="{{ block.settings.title }}"></div>',
            "<script>var name = '{{ shop.name }}';</script>",
            '<div title="{{ block.settings.title | escape }}"></div>',
            "<script>var name = {{ shop.name | json }};</script>",
            "{% style %}.x { color: {{ block.settings.text_color }}; }{% endstyle %}",
        ].join("\n");
        expect(unescapedOutputs(sample).map((f) => f.line)).toEqual([1, 2]);
    });

    it("reads every block file", () => {
        expect(BLOCK_FILES).toEqual(
            expect.arrayContaining([
                "listener.liquid",
                "banner.liquid",
                "referral_button.liquid",
            ])
        );
    });

    it.each(BLOCK_FILES)("%s escapes every output for its context", (file) => {
        const source = readFileSync(resolve(BLOCKS_DIR, file), "utf-8");
        expect(unescapedOutputs(source)).toEqual([]);
    });
});
