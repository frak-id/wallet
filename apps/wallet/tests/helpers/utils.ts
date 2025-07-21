import { readFile } from "node:fs";
import { promisify } from "node:util";
import type { Page } from "@playwright/test";
import { STORAGE_STATE } from "playwright.config";

/**
 * Load the frak storage state in the given page
 */
export async function loadFrakStorageState(page: Page): Promise<void> {
    try {
        console.log("Loading frak storage state...", page.url());
        // Read storage state file
        const rawStorageState = await promisify(readFile)(STORAGE_STATE, {
            encoding: "utf-8",
        });
        const storageState = JSON.parse(rawStorageState) as {
            origins: {
                origin: string;
                localStorage: { name: string; value: string }[];
            }[];
        };

        // Parse it
        const frakStorageState = storageState.origins.find(
            ({ origin }) =>
                origin.includes("frak.id") || origin.includes("localhost")
        )?.localStorage;
        if (!frakStorageState) {
            console.warn("No storage state found for frak.id or localhost");
            return;
        }

        // Save it
        await page.evaluate((items) => {
            localStorage.clear();
            for (const { name, value } of items) {
                localStorage.setItem(name, value);
            }
        }, frakStorageState);

        // Reload the page
        await page.reload();
    } catch (error) {
        console.error("Failed to load storage state:", error);
    }
}
