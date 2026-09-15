import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";

/** Class names are hashed in the build; the circle is the container's parent. */
const GLASS = ":has(> .liquid-glass-container)";
const TRANSPARENT = "rgba(0, 0, 0, 0)";

async function outlineOf(page: Page) {
    return page
        .locator(GLASS)
        .first()
        .evaluate((el) => {
            const cs = getComputedStyle(el);
            return {
                color: cs.outlineColor,
                width: cs.outlineWidth,
                style: cs.outlineStyle,
                focused: el.matches(":focus-visible, :focus-visible > *"),
            };
        });
}

test.describe("GlassButton focus ring", () => {
    test("stays transparent when idle and after a pointer press", async ({
        page,
    }) => {
        await page.goto("/history");
        await page.waitForLoadState("networkidle");

        const idle = await outlineOf(page);
        expect(idle.style).toBe("solid");
        expect(idle.width).toBe("2px");
        expect(idle.color).toBe(TRANSPARENT);

        const back = page.getByRole("link", { name: "Back" });
        const box = await back.boundingBox();
        if (!box) throw new Error("Back link has no box");
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        const pressed = await outlineOf(page);
        await page.mouse.up();

        expect(pressed.color).toBe(TRANSPARENT);
        expect(pressed.focused).toBe(false);
    });

    test("shows the ring when the Back wrapper takes keyboard focus", async ({
        page,
    }) => {
        await page.goto("/history");
        await page.waitForLoadState("networkidle");

        const back = page.getByRole("link", { name: "Back" });
        await back.focus();
        // `focus()` alone is not `:focus-visible`; a key press promotes it.
        await page.keyboard.press("Shift");
        await expect(back).toBeFocused();

        const focused = await outlineOf(page);
        expect(focused.focused).toBe(true);
        expect(focused.color).not.toBe(TRANSPARENT);

        await expect(page.locator(GLASS).first()).toHaveScreenshot(
            "glass-button-keyboard-focus.png",
            { animations: "disabled" }
        );
    });

    test("shows the ring on the standalone button variant", async ({
        page,
    }) => {
        await page.goto("/explorer");
        await page.waitForLoadState("networkidle");

        const sort = page.locator(`button${GLASS}`).first();
        await expect(sort).toBeVisible();
        await sort.focus();
        await page.keyboard.press("Shift");

        const focused = await sort.evaluate((el) => {
            const cs = getComputedStyle(el);
            return { color: cs.outlineColor, style: cs.outlineStyle };
        });
        expect(focused.style).toBe("solid");
        expect(focused.color).not.toBe(TRANSPARENT);
    });
});
