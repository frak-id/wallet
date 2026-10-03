#!/usr/bin/env bun
/**
 * Writes the template SVG imagesets the native glass chrome draws, from the
 * design-system icon sources, so the iOS icons never drift from the web ones.
 * Run: `bun run tauri:native-icons`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Asset name → design-system icon component and its point size on iOS. */
const ICONS: Record<string, { component: string; size: number }> = {
    "tab-wallet": { component: "WalletIcon", size: 24 },
    "tab-explorer": { component: "ExplorerIcon", size: 24 },
    "tab-profile": { component: "ProfileIcon", size: 24 },
};

const SOURCE_DIR = join(
    import.meta.dir,
    "../../../packages/design-system/src/icons"
);
const CATALOG_DIR = join(
    import.meta.dir,
    "../src-tauri/gen/apple/Assets.xcassets"
);

function toSvg(component: string, size: number): string {
    const source = readFileSync(join(SOURCE_DIR, `${component}.tsx`), "utf8");
    const viewBox = source.match(/viewBox="([^"]+)"/)?.[1];
    const paths = [...source.matchAll(/<path([\s\S]*?)\/>/g)].map(
        ([, attributes = ""]) => {
            const d = attributes.match(/\sd="([^"]+)"/)?.[1];
            if (!d) throw new Error(`${component}: a <path> has no d`);
            const rule = attributes.includes('fillRule="evenodd"')
                ? ' fill-rule="evenodd" clip-rule="evenodd"'
                : "";
            // actool does not resolve currentColor; template rendering ignores the colour anyway.
            return `<path${rule} d="${d}" fill="#000000"/>`;
        }
    );
    if (!viewBox || paths.length === 0) {
        throw new Error(`${component}: expected a viewBox and filled paths`);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}" fill="none">\n${paths.join("\n")}\n</svg>\n`;
}

function contents(name: string): string {
    return `{
  "images" : [
    {
      "filename" : "${name}.svg",
      "idiom" : "universal"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  },
  "properties" : {
    "preserves-vector-representation" : true,
    "template-rendering-intent" : "template"
  }
}
`;
}

for (const [name, { component, size }] of Object.entries(ICONS)) {
    const dir = join(CATALOG_DIR, `${name}.imageset`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${name}.svg`), toSvg(component, size));
    writeFileSync(join(dir, "Contents.json"), contents(name));
}
console.log(`✅ ${Object.keys(ICONS).length} native icon(s) written`);
