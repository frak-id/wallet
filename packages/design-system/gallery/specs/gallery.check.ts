import { expect, type Page, test } from "@playwright/test";
import { sections } from "../sections";
import { knownFindings } from "./known-findings";

const NARROW = { width: 320, height: 900 };
const MAX_TAB_STOPS = 300;
const FOCUSABLE = [
    "button:enabled",
    "input:enabled",
    "select:enabled",
    "textarea:enabled",
    "a[href]",
    "[tabindex]",
]
    .map((sel) => `${sel}:not([tabindex="-1"])`)
    .join(",");
// Browsers show focus on a clicked text field by design: it is where typing goes.
const TEXT_ENTRY =
    'input:not([type="checkbox"], [type="radio"]), textarea, [contenteditable]';
// Charts ignore `prefers-reduced-motion`; the longest enter animation is a
// ~1.1s tween plus under half a second of stagger.
const CHART_SETTLE_MS = 2_000;
const CLOCK_START = new Date("2026-01-01T00:00:00Z");

type Finding = { key: string; detail: string };

function trackErrors(page: Page) {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
        if (message.type() === "error")
            errors.push(`console.error: ${message.text()}`);
    });
    return errors;
}

async function openSection(page: Page, id: string, { fakeClock = false } = {}) {
    if (fakeClock) {
        // Paused before navigation, so no tween advances until the test says so.
        await page.clock.install({ time: CLOCK_START });
        await page.clock.pauseAt(new Date(CLOCK_START.getTime() + 1_000));
    }
    await page.goto(`/?only=${id}`);
    const section = page.locator(`[data-gallery-section="${id}"]`);
    const firstCase = section.locator("[data-gallery-case]").first();
    // React throttles revealing lazy content, and a chart debounces measuring its
    // parent, both on timers: step the paused clock until the chart has drawn.
    if (fakeClock)
        await expect
            .poll(async () => {
                await page.clock.runFor(100);
                return section.locator("svg").count();
            })
            .toBeGreaterThan(0);
    else await expect(firstCase).toBeVisible();
    // Overflow and focus geometry depend on Inter's metrics, so wait for it.
    await page.evaluate(() => document.fonts.ready);
    expect(
        await page.evaluate(() =>
            [...document.fonts].some(
                (face) =>
                    face.family.replaceAll('"', "") === "Inter" &&
                    face.status === "loaded"
            )
        ),
        "Inter did not load"
    ).toBe(true);
    // Transitions would leave a focus ring mid-fade when it is read.
    await page.addStyleTag({
        content:
            "*,*::before,*::after{transition:none!important;animation:none!important}",
    });
    return section;
}

/** Fails on a finding not in `known-findings.ts`, and on a listed one that is gone. */
function expectFindings(kind: string, id: string, found: Finding[]) {
    const prefix = `${kind}:${id}:`;
    const expected = Object.keys(knownFindings).filter((k) =>
        k.startsWith(prefix)
    );
    const foundKeys = new Set(found.map((f) => f.key));
    const unexpected = found
        .filter((f) => !(f.key in knownFindings))
        .map((f) => `${f.key} -> ${f.detail}`);
    const fixed = expected.filter((k) => !foundKeys.has(k));
    expect(unexpected, `${kind} problems in "${id}"`).toEqual([]);
    expect(
        fixed,
        `known ${kind} findings that no longer occur: delete them from known-findings.ts`
    ).toEqual([]);
}

type Wrapper = {
    focusedBorder: string;
    idleBorder: string;
    borderWidth: number;
    background: string[];
};

type StopFacts = {
    caseName: string;
    who: string;
    focusVisible: boolean;
    outline: { width: number; style: string; color: string; offset: number };
    boxShadow: string;
    idle: { outline: string; boxShadow: string };
    parentBackground: string[];
    fill: string;
    wrappers: Wrapper[];
};

/** Runs in the page: reads what the element Tab just focused looks like. */
function readFocus(sectionId: string): StopFacts | "left" {
    const root = document.querySelector(
        `[data-gallery-section="${sectionId}"]`
    );
    const el = document.activeElement;
    if (!root || !(el instanceof HTMLElement) || !root.contains(el))
        return "left";

    const backgroundStack = (from: Element | null) => {
        const stack: string[] = [];
        for (let n = from; n; n = n.parentElement) {
            const color = getComputedStyle(n).backgroundColor;
            if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent")
                stack.push(color);
        }
        return stack;
    };

    const chain: HTMLElement[] = [];
    for (let n = el.parentElement; n && n !== root; n = n.parentElement)
        chain.push(n);
    const borders = () => chain.map((n) => getComputedStyle(n).borderColor);

    const cs = getComputedStyle(el);
    const outline = {
        width: Number.parseFloat(cs.outlineWidth),
        style: cs.outlineStyle,
        color: cs.outlineColor,
        offset: Number.parseFloat(cs.outlineOffset),
    };
    const { boxShadow } = cs;
    const focusVisible = el.matches(":focus-visible");
    const focusedBorders = borders();
    el.blur();
    const idleBorders = borders();
    const idleStyle = getComputedStyle(el);
    const idle = {
        outline: `${idleStyle.outlineStyle} ${Number.parseFloat(idleStyle.outlineWidth)}px ${idleStyle.outlineColor}`,
        boxShadow: idleStyle.boxShadow,
    };
    el.focus();

    return {
        caseName:
            el
                .closest("[data-gallery-case]")
                ?.getAttribute("data-gallery-case") ?? "<section>",
        who: `<${el.tagName.toLowerCase()}> "${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30) ?? ""}"`,
        focusVisible,
        outline,
        boxShadow,
        idle,
        parentBackground: backgroundStack(el.parentElement),
        fill: cs.backgroundColor,
        wrappers: chain.map((n, i) => ({
            focusedBorder: focusedBorders[i],
            idleBorder: idleBorders[i],
            borderWidth: Number.parseFloat(getComputedStyle(n).borderTopWidth),
            background: backgroundStack(n),
        })),
    };
}

type Rgb = { r: number; g: number; b: number; a: number };

function parseColor(color: string): Rgb | null {
    const srgb = color.match(/color\(srgb\s+([^)]+)\)/);
    const legacy = color.match(/rgba?\(([^)]+)\)/);
    const m = srgb ?? legacy;
    if (!m) return null;
    const [r, g, b, a = 1] = m[1]
        .split(/[,/\s]+/)
        .filter(Boolean)
        .map(Number);
    const scale = srgb ? 255 : 1;
    return { r: r * scale, g: g * scale, b: b * scale, a };
}

function isVisibleColor(color: string) {
    return color !== "transparent" && (parseColor(color)?.a ?? 1) > 0;
}

/** Composites `color` over an opaque base. */
function over(color: Rgb, base: Rgb): Rgb {
    const mix = (fg: number, bg: number) => fg * color.a + bg * (1 - color.a);
    return {
        r: mix(color.r, base.r),
        g: mix(color.g, base.g),
        b: mix(color.b, base.b),
        a: 1,
    };
}

/** Resolves nearest-first backgrounds into the opaque colour they paint over white. */
function resolveBackground(stack: string[]): Rgb | null {
    let resolved: Rgb = { r: 255, g: 255, b: 255, a: 1 };
    for (const color of [...stack].reverse()) {
        const parsed = parseColor(color);
        if (!parsed) return null;
        resolved = over(parsed, resolved);
    }
    return resolved;
}

function luminance({ r, g, b }: Rgb) {
    const [lr, lg, lb] = [r, g, b].map((channel) => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: Rgb, b: Rgb) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

/** Visible non-inset shadow layers, outermost first, and whether the ring is one layer with no offset or blur. */
function outerShadow(boxShadow: string) {
    const layers = [
        ...boxShadow.matchAll(
            /(rgba?\([^)]*\)|color\([^)]*\))((?:\s+-?[\d.]+px){2,4})(\s+inset)?/g
        ),
    ]
        .filter((m) => !m[3] && isVisibleColor(m[1]))
        .map((m) => {
            const [x, y, blur = 0, spread = 0] = m[2]
                .trim()
                .split(/\s+/)
                .map(Number.parseFloat);
            return {
                color: m[1],
                reach: blur + spread,
                spreadOnly: x === 0 && y === 0 && blur === 0 && spread > 0,
            };
        })
        .sort((a, b) => b.reach - a.reach);
    const ring = layers[0];
    return ring
        ? {
              colors: layers.map((l) => l.color),
              flush: layers.length === 1 && ring.spreadOnly,
          }
        : null;
}

/** A two-tone ring passes when any one band reaches the ratio (WCAG technique C40); bands meet the fill only when flush. */
type Ring = { colors: string[]; background: string[]; flush: boolean };

function findRing(facts: StopFacts): Ring | null {
    const { outline, boxShadow, idle } = facts;
    const background = facts.parentBackground;
    const outlineText = `${outline.style} ${outline.width}px ${outline.color}`;
    const shadow = boxShadow !== idle.boxShadow && outerShadow(boxShadow);
    if (
        outline.width > 0 &&
        outline.style !== "none" &&
        isVisibleColor(outline.color) &&
        outlineText !== idle.outline
    )
        return {
            colors: [outline.color, ...(shadow ? shadow.colors : [])],
            background,
            flush: outline.offset <= 0,
        };
    if (shadow) return { ...shadow, background };
    const wrapper = facts.wrappers.find(
        (w) => w.borderWidth > 0 && w.focusedBorder !== w.idleBorder
    );
    return wrapper
        ? {
              colors: [wrapper.focusedBorder],
              background: wrapper.background,
              flush: false,
          }
        : null;
}

const MIN_RING_CONTRAST = 3;

/** A failure message, or null when the stop shows a ring with 3:1 contrast (WCAG 1.4.11). */
function inspectStop(facts: StopFacts) {
    if (!facts.focusVisible) return "not :focus-visible after Tab";
    const ring = findRing(facts);
    if (!ring)
        return `no focus indicator (outline ${facts.outline.style} ${facts.outline.width}px, box-shadow ${facts.boxShadow})`;
    const background = resolveBackground(ring.background);
    const paints = ring.colors.map(parseColor);
    if (!background || paints.some((p) => !p))
        return `cannot parse ring ${ring.colors.join(", ")} or its background`;
    const against = [{ name: "background", color: background }];
    if (ring.flush && isVisibleColor(facts.fill)) {
        const fill = resolveBackground([facts.fill, ...ring.background]);
        if (fill) against.push({ name: "fill", color: fill });
    }
    const weak = against
        .map(({ name, color }) => ({
            name,
            ratio: Math.max(
                ...paints.map((p) =>
                    p ? contrast(over(p, background), color) : 0
                )
            ),
        }))
        .filter(({ ratio }) => ratio < MIN_RING_CONTRAST)
        .map(({ name, ratio }) => `${ratio.toFixed(2)}:1 against the ${name}`);
    if (weak.length > 0)
        return `ring ${ring.colors.join(" + ")} needs ${MIN_RING_CONTRAST}:1 but has ${weak.join(" and ")}`;
    return null;
}

/** Runs in the page: the ring a pointer press left on `el`, or null when there is none. */
function readPointerRing(el: Element) {
    if (!(el instanceof HTMLElement) || el !== document.activeElement)
        return null;
    const paint = () => {
        const cs = getComputedStyle(el);
        const outline =
            cs.outlineStyle === "none" ||
            Number.parseFloat(cs.outlineWidth) === 0 ||
            /rgba\(.*,\s*0\)|transparent/.test(cs.outlineColor)
                ? "none"
                : `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`;
        return `outline ${outline}, box-shadow ${cs.boxShadow}`;
    };
    const focused = paint();
    el.blur();
    const idle = paint();
    return focused === idle ? null : `${focused} (idle: ${idle})`;
}

/** Runs in the page: what is wrong with an open overlay in the viewport. */
function readOverlay(el: Element) {
    const problems: string[] = [];
    const box = el.getBoundingClientRect();
    const { innerWidth, innerHeight } = window;
    if (box.left < 0 || box.right > innerWidth)
        problems.push(
            `spans ${Math.round(box.left)}..${Math.round(box.right)}px of a ${innerWidth}px viewport`
        );
    if (box.bottom > innerHeight + 1)
        problems.push(
            `ends ${Math.round(box.bottom - innerHeight)}px below the viewport`
        );
    // Visually hidden text (`clip: rect(0 0 0 0)`) is a 1px box on purpose.
    const clipped = (n: Element) =>
        getComputedStyle(n).clip === "rect(0px, 0px, 0px, 0px)";
    if (
        [el, ...el.querySelectorAll("*")].some(
            (n) => n.scrollWidth > n.clientWidth + 1 && !clipped(n)
        )
    )
        problems.push("content is wider than its box");
    if (!el.contains(document.activeElement))
        problems.push("focus did not move into it");
    return problems;
}

test("every known finding names a registry section and a checked kind", () => {
    const ids = new Set(sections.map((s) => s.id));
    const orphans = Object.keys(knownFindings).filter((key) => {
        const [kind, id] = key.split(":");
        return (
            !["overflow", "focus", "overlay", "pointer"].includes(kind) ||
            !ids.has(id)
        );
    });
    expect(orphans).toEqual([]);
});

test("the full page renders every registry section", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    for (const { id } of sections) {
        const section = page.locator(`[data-gallery-section="${id}"]`);
        await expect(
            section.locator("[data-gallery-case]").first(),
            `section "${id}" rendered no cases`
        ).toBeVisible();
    }
    expect(errors).toEqual([]);
});

for (const { id, title } of sections) {
    test.describe(`${id}`, () => {
        test("renders without errors in a non-empty box", async ({ page }) => {
            const errors = trackErrors(page);
            const section = await openSection(page, id);
            await expect(section).toBeVisible();
            const box = await section.boundingBox();
            expect(
                box?.width,
                `"${title}" is squeezed below the desktop page width`
            ).toBeGreaterThan(600);
            expect(box?.height, `"${title}" has no height`).toBeGreaterThan(0);
            expect(errors).toEqual([]);
        });

        test("does not overflow horizontally at 320px", async ({ page }) => {
            await page.setViewportSize(NARROW);
            const section = await openSection(page, id);
            // Only the section root is gated: Cards and fields clip with
            // `overflow: hidden`, so a per-descendant sweep is mostly noise.
            // Its scrollWidth also counts text spilling out of a box, which
            // element rectangles miss, so cases are blamed by their own scroll.
            const found = await section.evaluate((root) => {
                if (root.scrollWidth <= root.clientWidth) return [];
                const cases = [
                    ...root.querySelectorAll("[data-gallery-case]"),
                ].filter((el) => el.scrollWidth > el.clientWidth);
                const blamed = cases.length > 0 ? cases : [root];
                return blamed.map((el) => ({
                    key: el.getAttribute("data-gallery-case") ?? "<section>",
                    detail: `content is ${el.scrollWidth - el.clientWidth}px wider than its box`,
                }));
            });
            expectFindings(
                "overflow",
                id,
                found.map((f) => ({ ...f, key: `overflow:${id}:${f.key}` }))
            );
        });

        test("shows a focus indicator on every tab stop", async ({ page }) => {
            const section = await openSection(page, id);
            const focusables = await section.evaluate(
                (root, focusable) =>
                    [...root.querySelectorAll(focusable)].filter((el) =>
                        el.checkVisibility()
                    ).length,
                FOCUSABLE
            );
            // A press that focuses nothing must not hide the ring from later keyboard focus.
            for (const target of await section.locator(FOCUSABLE).all())
                if (await target.isVisible())
                    await target.click({ button: "right", force: true });
            await section.locator(`#${id}-title`).focus();
            const found: Finding[] = [];
            let stops = 0;
            for (; stops < MAX_TAB_STOPS; stops++) {
                await page.keyboard.press("Tab");
                const facts = await page.evaluate(readFocus, id);
                if (facts === "left") break;
                const problem = inspectStop(facts);
                if (problem)
                    found.push({
                        key: `focus:${id}:${facts.caseName}`,
                        detail: `${facts.who}: ${problem}`,
                    });
            }
            expect(stops, "tab order never left the section").toBeLessThan(
                MAX_TAB_STOPS
            );
            if (focusables > 0)
                expect(
                    stops,
                    `${focusables} focusable elements but Tab reached none`
                ).toBeGreaterThan(0);
            expectFindings("focus", id, found);
        });

        test("opens every overlay inside a 320px viewport", async ({
            page,
        }) => {
            const errors = trackErrors(page);
            await page.setViewportSize(NARROW);
            const section = await openSection(page, id);
            const triggers = section.locator("[data-gallery-open]");
            const count = await triggers.count();
            test.skip(count === 0, "no overlay in this section");
            const found: Finding[] = [];
            for (let i = 0; i < count; i++) {
                const trigger = triggers.nth(i);
                const caseName = await trigger.evaluate(
                    (el) =>
                        el
                            .closest("[data-gallery-case]")
                            ?.getAttribute("data-gallery-case") ?? "<section>"
                );
                const report = (detail: string) =>
                    found.push({ key: `overlay:${id}:${caseName}`, detail });
                await trigger.focus();
                await page.keyboard.press("Enter");
                const dialog = page.getByRole("dialog");
                await expect(dialog, `${caseName} did not open`).toBeVisible();
                for (const problem of await dialog.evaluate(readOverlay))
                    report(problem);
                await page.keyboard.press("Escape");
                await expect(
                    dialog,
                    `${caseName} did not close on Escape`
                ).toHaveCount(0);
                const returned = await expect
                    .poll(
                        () =>
                            trigger.evaluate(
                                (el) => el === document.activeElement
                            ),
                        { timeout: 1_000 }
                    )
                    .toBe(true)
                    .then(
                        () => true,
                        () => false
                    );
                if (!returned)
                    report("focus did not return to its trigger on close");
            }
            expectFindings("overlay", id, found);
            expect(errors).toEqual([]);
        });

        test("shows no focus ring after a pointer press", async ({ page }) => {
            const section = await openSection(page, id);
            const targets = section.locator(FOCUSABLE);
            const count = await targets.count();
            const found: Finding[] = [];
            for (let i = 0; i < count; i++) {
                const target = await targets.nth(i).elementHandle();
                if (
                    !target ||
                    (await target.evaluate(
                        (el, textEntry) =>
                            !el.checkVisibility() || el.matches(textEntry),
                        TEXT_ENTRY
                    ))
                )
                    continue;
                await target.scrollIntoViewIfNeeded();
                const box = await target.boundingBox();
                if (!box) continue;
                await page.mouse.click(
                    box.x + box.width / 2,
                    box.y + box.height / 2
                );
                const ring = await target.evaluate(readPointerRing);
                if (ring) {
                    const caseName = await target.evaluate(
                        (el) =>
                            el
                                .closest("[data-gallery-case]")
                                ?.getAttribute("data-gallery-case") ??
                            "<section>"
                    );
                    found.push({
                        key: `pointer:${id}:${caseName}`,
                        detail: ring,
                    });
                }
                const popup = page.locator('[role="dialog"], [role="listbox"]');
                if ((await popup.count()) > 0) {
                    await page.keyboard.press("Escape");
                    await expect(popup).toHaveCount(0);
                }
            }
            expectFindings("pointer", id, found);
        });

        test("matches its screenshot", async ({ page }, testInfo) => {
            test.skip(
                testInfo.project.ignoreSnapshots,
                "pixel baselines are opt-in: GALLERY_SNAPSHOTS=1"
            );
            const isChart = id.startsWith("chart-");
            const section = await openSection(page, id, { fakeClock: isChart });
            if (isChart) {
                await page.clock.runFor(CHART_SETTLE_MS);
                // Repaint from scratch: raster tiles kept from the enter animation vary run to run.
                await section.evaluate((el: HTMLElement) => {
                    el.style.display = "none";
                    void el.offsetHeight;
                    el.style.display = "";
                });
            }
            await expect(section).toBeVisible();
            await expect(section).toHaveScreenshot(`${id}.png`, {
                animations: "disabled",
            });
        });
    });
}
