async function makePng(page, width, height) {
    const dataUrl = await page.evaluate(
        ([w, h]) => {
            const c = document.createElement("canvas");
            c.width = w;
            c.height = h;
            const ctx = c.getContext("2d");
            const g = ctx.createLinearGradient(0, 0, w, h);
            g.addColorStop(0, "#ff5f6d");
            g.addColorStop(1, "#4a6cf7");
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = "#fff";
            ctx.font = `bold ${Math.floor(Math.min(w, h) / 4)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`${w}×${h}`, w / 2, h / 2);
            return c.toDataURL("image/png");
        },
        [width, height]
    );
    return Buffer.from(dataUrl.split(",")[1], "base64");
}

const png = async (page, name, w, h) => ({
    name,
    mimeType: "image/png",
    buffer: await makePng(page, w, h),
});

// The dropzone owning the restriction caption, then its file input.
const fileInput = (page, caption) =>
    page
        .getByText(caption)
        .locator("xpath=ancestor::div[.//input[@type='file']][1]")
        .locator("input[type=file]");

const LOGO = /At least 128×128 px/;
const HERO = /800×450 px.*maximum\.$/;
const SLIDER = /800×450 px.*\(\d\/4\)$/;

const imageSize = (page, src) =>
    page.evaluate(async (s) => {
        const i = new Image();
        i.src = s;
        await i.decode();
        return { width: i.naturalWidth, height: i.naturalHeight };
    }, src);

export default async ({ page, merchantId, step, expect }) => {
    await page
        .locator(`a[href$="/m/${merchantId}/merchant/customize"]`)
        .click();
    await page.getByRole("tab", { name: "App listing" }).click();
    await expect(page).toHaveURL(/\/merchant\/explorer$/);
    await step("explorer");

    const dialog = page.getByRole("dialog", { name: "Crop your image" });
    const useAsIs = dialog.getByRole("button", { name: "Use as is" });
    const current = page.getByRole("img", { name: "Current image" });

    // 1. Too-wide logo (4:1): crop forced on 2:1, no "Use as is".
    await fileInput(page, LOGO).setInputFiles(
        await png(page, "wordmark.png", 1200, 300)
    );
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("tab", { name: "2:1" })).toHaveAttribute(
        "aria-selected",
        "true"
    );
    await expect(dialog.getByText(/1:2 to 2:1/)).toBeVisible();
    await expect(useAsIs).toHaveCount(0);
    await expect(dialog).toHaveCSS("opacity", "1");
    await step("logo-crop-dialog");
    await dialog.getByLabel("Zoom").fill("1.5");
    await dialog.getByRole("button", { name: "Crop and upload" }).click();
    await expect(dialog).toBeHidden();
    await expect(current).toHaveCount(1);
    await expect(page.getByText(LOGO)).toHaveCount(0);
    const logo = await imageSize(page, await current.getAttribute("src"));
    console.log("LOGO OUTPUT", logo);
    expect(logo).toEqual({ width: 400, height: 200 });
    await step("logo-uploaded-preview");

    // 2. Square hero: starts on 4:3, switch to 16:9, cancel: nothing uploaded.
    await fileInput(page, HERO).setInputFiles(
        await png(page, "square.png", 1600, 1600)
    );
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("tab")).toHaveText(["4:3", "16:9", "2:1"]);
    await dialog.getByRole("tab", { name: "16:9" }).click();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(current).toHaveCount(1);

    // 3. In-range hero (16:9): the dialog still opens, "Use as is" keeps the original.
    await fileInput(page, HERO).setInputFiles(
        await png(page, "wide.png", 1600, 900)
    );
    await expect(dialog).toBeVisible();
    await expect(
        dialog.getByText("Drag and zoom to frame your image, or use it as is.")
    ).toBeVisible();
    await expect(dialog.getByRole("tab", { name: "16:9" })).toHaveAttribute(
        "aria-selected",
        "true"
    );
    await expect(dialog).toHaveCSS("opacity", "1");
    await step("hero-in-range-dialog");
    await useAsIs.click();
    await expect(dialog).toBeHidden();
    await expect(current).toHaveCount(2);
    const hero = await imageSize(
        page,
        await current.first().getAttribute("src")
    );
    console.log("HERO AS-IS", hero);
    expect(hero).toEqual({ width: 1600, height: 900 });
    await step("hero-uploaded-preview");

    // 4. Edit reopens the URL + dropzone for that field only, Done closes it.
    await page.getByRole("button", { name: "Edit" }).first().click();
    await expect(page.getByText(HERO)).toBeVisible();
    await expect(page.getByPlaceholder("https://...").first()).toHaveValue(
        /^blob:/
    );
    await step("hero-editing");
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText(HERO)).toHaveCount(0);

    // 5. Slider batch from the empty dropzone: one dialog per file, in order.
    await step("slider-empty");
    await fileInput(page, SLIDER).setInputFiles([
        await png(page, "tall.png", 1000, 1400),
        await png(page, "banner.png", 1800, 900),
    ]);
    await expect(dialog).toBeVisible();
    await expect(useAsIs).toHaveCount(0);
    await dialog.getByRole("button", { name: "Crop and upload" }).click();
    await expect(useAsIs).toBeVisible();
    await useAsIs.click();
    const slides = page.locator("li img[src^='blob:']");
    await expect.poll(() => slides.count()).toBe(2);
    const sizes = await slides.evaluateAll((imgs) =>
        imgs.map((i) => ({ w: i.naturalWidth, h: i.naturalHeight }))
    );
    console.log("SLIDES", sizes);
    expect(sizes).toEqual([
        { w: 1000, h: 750 },
        { w: 1800, h: 900 },
    ]);
    await expect(page.getByRole("img", { name: "Slide 1" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Slide 2" })).toBeVisible();
    await expect(page.getByText(SLIDER)).toHaveCount(0);
    const addTile = page.getByRole("button", { name: "Add image (2/4)" });
    await expect(addTile).toBeVisible();
    await step("slider-grid");

    // 6. Add a third through the add tile, then remove slide 1: the rest renumber.
    await addTile
        .locator("xpath=ancestor::div[.//input[@type='file']][1]")
        .locator("input[type=file]")
        .setInputFiles(await png(page, "third.png", 1600, 900));
    await useAsIs.click();
    await expect.poll(() => slides.count()).toBe(3);
    await expect(
        page.getByRole("button", { name: "Add image (3/4)" })
    ).toBeVisible();
    const secondSrc = await page
        .getByRole("img", { name: "Slide 2" })
        .getAttribute("src");
    await page.getByRole("button", { name: "Remove image 1" }).click();
    await expect.poll(() => slides.count()).toBe(2);
    await expect(page.getByRole("img", { name: "Slide 1" })).toHaveAttribute(
        "src",
        secondSrc
    );
    await step("slider-after-remove");
};
