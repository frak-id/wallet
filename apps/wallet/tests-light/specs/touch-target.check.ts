import type { Locator } from "@playwright/test";
import { expect, test } from "../fixtures";

// Past the 22px reach of a region centred on the 16px icon, so these fail if the
// inward anchoring is lost.
const INWARD: [number, number][] = [
    [0, 26],
    [-26, 0],
    [-24, 24],
];

async function hitTest(control: Locator, offsets: [number, number][]) {
    return control.evaluate((btn, directions) => {
        const rect = btn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        return {
            hits: directions.map(([dx, dy]) => {
                const el = document.elementFromPoint(cx + dx, cy + dy);
                return el === btn || btn.contains(el);
            }),
            afterWidth: getComputedStyle(btn, "::after").width,
        };
    }, offsets);
}

test.describe("44px touch target", () => {
    test("welcome-card dismiss claims the taps that would navigate", async ({
        page,
    }) => {
        await page.goto("/wallet");
        await page.waitForLoadState("networkidle");

        const dismiss = page.getByRole("button", { name: "Close" }).first();
        await expect(dismiss).toBeVisible();

        const { hits, afterWidth } = await hitTest(dismiss, INWARD);
        expect(hits).toEqual([true, true, true]);
        expect(afterWidth).toBe("44px");
    });

    test("welcome-card dismiss keeps its original 8px inset", async ({
        page,
    }) => {
        await page.goto("/wallet");
        await page.waitForLoadState("networkidle");

        const dismiss = page.getByRole("button", { name: "Close" }).first();
        await expect(dismiss).toBeVisible();

        const inset = await dismiss.evaluate((btn) => {
            const card = btn.closest('[class*="cardContainer"]');
            if (!card) return null;
            const b = btn.getBoundingClientRect();
            const c = card.getBoundingClientRect();
            return {
                top: Math.round(b.top - c.top),
                right: Math.round(c.right - b.right),
            };
        });
        expect(inset).toEqual({ top: 8, right: 8 });
    });
});
