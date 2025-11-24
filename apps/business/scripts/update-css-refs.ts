#!/usr/bin/env bun
/**
 * Post-build script to update CSS references in __root.tsx
 * This ensures the correct hashed CSS filename is used after each build
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ASSETS_DIR = join(import.meta.dir, "../.output/public/assets");
const ROOT_FILE = join(import.meta.dir, "../src/routes/__root.tsx");

try {
    // Find the style-*.css file
    const files = readdirSync(ASSETS_DIR);
    const styleFile = files.find(
        (f) => f.startsWith("style-") && f.endsWith(".css")
    );

    if (!styleFile) {
        console.warn("⚠️  Could not find style-*.css file");
        process.exit(0);
    }

    const stylePath = `/assets/${styleFile}`;
    console.log(`✓ Found component CSS: ${stylePath}`);

    // Update __root.tsx
    let content = readFileSync(ROOT_FILE, "utf-8");

    // Replace the hardcoded CSS path with the new one
    const cssRegex =
        /{ rel: "stylesheet", href: "\/assets\/style-[^"]+\.css" }/;
    const replacement = `{ rel: "stylesheet", href: "${stylePath}" }`;

    if (cssRegex.test(content)) {
        content = content.replace(cssRegex, replacement);
        writeFileSync(ROOT_FILE, content, "utf-8");
        console.log(`✓ Updated __root.tsx with ${stylePath}`);
    } else {
        console.warn("⚠️  Could not find CSS reference pattern in __root.tsx");
    }
} catch (error) {
    console.error("❌ Error updating CSS references:", error);
    process.exit(1);
}
