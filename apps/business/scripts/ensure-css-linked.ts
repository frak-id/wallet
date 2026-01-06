#!/usr/bin/env bun
/**
 * Post-build script to ensure CSS modules bundle is linked in __root.tsx
 * This script finds the generated style-*.css file and ensures it's linked in the head
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ASSETS_DIR = join(import.meta.dir, "../.output/public/assets");
const ROOT_FILE = join(import.meta.dir, "../src/routes/__root.tsx");

try {
    // Check if assets directory exists
    try {
        readdirSync(ASSETS_DIR);
    } catch {
        console.warn(
            "⚠️  Assets directory not found. Run 'bun run build' first."
        );
        process.exit(0);
    }

    // Find the style-*.css file (CSS modules bundle)
    const files = readdirSync(ASSETS_DIR);
    const styleFile = files.find(
        (f) => f.startsWith("style-") && f.endsWith(".css")
    );

    if (!styleFile) {
        console.warn("⚠️  Could not find style-*.css file (CSS modules bundle)");
        console.warn("   CSS modules may not be loading correctly");
        process.exit(0);
    }

    const stylePath = `/assets/${styleFile}`;
    console.log(`✓ Found CSS modules bundle: ${stylePath}`);

    // Read the root file
    let content = readFileSync(ROOT_FILE, "utf-8");

    // Check if the CSS link already exists
    if (content.includes(stylePath)) {
        console.log(`✓ CSS modules bundle already linked: ${stylePath}`);
        process.exit(0);
    }

    // Find the links array in the head function
    // Look for the pattern: links: [ ... { rel: "stylesheet", href: appCss }, ... ]
    const linksArrayMatch = content.match(/links:\s*\[([\s\S]*?)\]/);

    if (!linksArrayMatch) {
        console.warn("⚠️  Could not find links array in __root.tsx");
        process.exit(1);
    }

    // Check if there's already a style-*.css link (old hash)
    const oldStyleLinkRegex =
        /\{\s*rel:\s*["']stylesheet["'],\s*href:\s*["']\/assets\/style-[^"']+\.css["']\s*\}/;

    if (oldStyleLinkRegex.test(content)) {
        // Replace the old link with the new one
        content = content.replace(
            oldStyleLinkRegex,
            `{ rel: "stylesheet", href: "${stylePath}" }`
        );
        console.log(`✓ Updated CSS modules bundle link: ${stylePath}`);
    } else {
        // Add the new link after appCss
        const appCssLinkRegex =
            /\{\s*rel:\s*["']stylesheet["'],\s*href:\s*appCss\s*\}/;
        if (appCssLinkRegex.test(content)) {
            content = content.replace(
                appCssLinkRegex,
                `{ rel: "stylesheet", href: appCss },\n            // CSS modules bundle (auto-updated by scripts/ensure-css-linked.ts)\n            { rel: "stylesheet", href: "${stylePath}" }`
            );
            console.log(`✓ Added CSS modules bundle link: ${stylePath}`);
        } else {
            console.warn(
                "⚠️  Could not find appCss link to add CSS modules bundle after"
            );
            process.exit(1);
        }
    }

    // Write the updated file
    writeFileSync(ROOT_FILE, content, "utf-8");
    console.log(`✓ Updated __root.tsx with CSS modules bundle link`);
} catch (error) {
    console.error("❌ Error ensuring CSS modules bundle is linked:", error);
    process.exit(1);
}
