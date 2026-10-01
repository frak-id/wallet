import { cleanup, renderHook } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type HostThemeTarget, useHostTheme } from "./useHostTheme";

const HOST_COLOR = "rgb(0, 128, 0)";
const OUR_CTA_COLOR = "rgb(17, 17, 17)";

type Rect = { left: number; top: number; width: number; height: number };

function domRect({ left, top, width, height }: Rect): DOMRect {
    return new DOMRect(left, top, width, height);
}

function stubRect(el: HTMLElement, rect: Rect): void {
    Object.defineProperty(el, "getBoundingClientRect", {
        configurable: true,
        value: () => domRect(rect),
    });
}

function stubSize(el: HTMLElement, width: number, height: number): void {
    Object.defineProperty(el, "offsetWidth", {
        configurable: true,
        value: width,
    });
    Object.defineProperty(el, "offsetHeight", {
        configurable: true,
        value: height,
    });
}

function makeRoot(withOurCta = true): HTMLElement {
    const root = document.createElement("div");
    root.className = "frak-ambassador";
    document.body.append(root);
    if (!withOurCta) return root;

    const cta = document.createElement("button");
    cta.className = "our-cta";
    cta.style.backgroundColor = OUR_CTA_COLOR;
    cta.style.color = "rgb(255, 255, 255)";
    cta.textContent = "Share";
    root.append(cta);
    stubSize(cta, 600, 100);
    stubRect(cta, { left: 20, top: 20, width: 600, height: 100 });
    return root;
}

function makeHostButton(parent: HTMLElement, rect: Rect): HTMLElement {
    const btn = document.createElement("button");
    btn.className = "host-cta";
    btn.style.backgroundColor = HOST_COLOR;
    btn.textContent = "Add to cart";
    parent.append(btn);
    stubSize(btn, rect.width, rect.height);
    stubRect(btn, rect);
    return btn;
}

function mount(target: HostThemeTarget) {
    return renderHook(() => useHostTheme(target));
}

function knob(el: HTMLElement, name: string): string {
    return el.style.getPropertyValue(`--frak-amb-${name}`);
}

function frame(): Promise<void> {
    return new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
    });
}

async function settle(): Promise<void> {
    for (let i = 0; i < 6; i += 1) await frame();
}

afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    document.body.removeAttribute("style");
});

describe("useHostTheme", () => {
    it("writes the accent sampled from the host's primary button", async () => {
        const root = makeRoot();
        const track = document.createElement("div");
        document.body.append(track);
        stubRect(track, { left: 0, top: 0, width: 100, height: 100 });
        makeHostButton(track, { left: 10, top: 10, width: 200, height: 50 });

        mount({ current: root });
        await settle();

        expect(knob(root, "accent")).toBe(HOST_COLOR);
        expect(knob(root, "accent-ink")).not.toBe("");
    });

    it("writes the typography and radius knobs sampled from the host", async () => {
        const root = makeRoot();
        const h1 = document.createElement("h1");
        h1.style.cssText =
            "font-size: 40px; font-weight: 700; letter-spacing: 1px; color: rgb(10, 10, 10)";
        const h2 = document.createElement("h2");
        h2.style.cssText =
            "font-size: 28px; font-weight: 600; letter-spacing: 0.5px; color: rgb(20, 20, 20)";
        const card = document.createElement("div");
        // jsdom computes a borderless card's top width as 16px; a browser says 0px.
        card.style.cssText =
            "background-color: rgb(245, 245, 245); border-top-width: 0px; border-top-left-radius: 12px";
        stubRect(card, { left: 0, top: 200, width: 300, height: 200 });
        document.body.append(h1, h2, card);
        const btn = makeHostButton(document.body, {
            left: 10,
            top: 10,
            width: 200,
            height: 50,
        });
        btn.style.cssText +=
            "; font-size: 15px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; border-radius: 4px";

        mount({ current: root });
        await settle();

        expect(knob(root, "h1-size")).toBe("min(40px, 3.2em)");
        expect(knob(root, "h1-weight")).toBe("700");
        expect(knob(root, "h1-spacing")).toBe("1px");
        expect(knob(root, "h1-color")).toBe("rgb(10, 10, 10)");
        expect(knob(root, "h2-size")).toBe("min(28px, 2em)");
        expect(knob(root, "h2-weight")).toBe("600");
        expect(knob(root, "h2-color")).toBe("rgb(20, 20, 20)");
        expect(knob(root, "cta-size")).toBe("15px");
        expect(knob(root, "cta-weight")).toBe("500");
        expect(knob(root, "cta-spacing")).toBe("2px");
        expect(knob(root, "cta-transform")).toBe("uppercase");
        expect(knob(root, "cta-radius")).toBe("4px");
        expect(knob(root, "cta-color")).toBe("");
        expect(knob(root, "radius")).toBe("12px");
    });

    it("keeps a heading colour that is unreadable on the component's own backdrop, even when it reads on the page", async () => {
        document.body.style.backgroundColor = "rgb(40, 40, 40)";
        const h1 = document.createElement("h1");
        h1.style.color = "rgb(255, 255, 255)";
        const card = document.createElement("main");
        card.style.backgroundColor = "rgb(255, 255, 255)";
        document.body.append(h1, card);
        const root = makeRoot(false);
        card.append(root);

        mount({ current: root });
        await settle();

        expect(knob(root, "h1-size")).not.toBe("");
        expect(knob(root, "h1-color")).toBe("");
    });

    it("does not take a ghost button's translucent fill as the accent", async () => {
        const root = makeRoot();
        const btn = makeHostButton(document.body, {
            left: 10,
            top: 10,
            width: 200,
            height: 50,
        });
        btn.style.backgroundColor = "rgba(17, 17, 17, 0.05)";

        mount({ current: root });
        await settle();

        expect(knob(root, "accent")).toBe("");
    });

    it("abstains on host colours it cannot measure, such as oklch()", async () => {
        const root = makeRoot();
        const h1 = document.createElement("h1");
        h1.style.cssText = "font-size: 40px; color: oklch(0.97 0 0)";
        document.body.append(h1);
        const btn = makeHostButton(document.body, {
            left: 10,
            top: 10,
            width: 200,
            height: 50,
        });
        btn.style.backgroundColor = "oklch(0.97 0 0)";

        mount({ current: root });
        await settle();

        expect(knob(root, "accent")).toBe("");
        expect(knob(root, "h1-color")).toBe("");
        expect(knob(root, "h1-size")).toBe("min(40px, 3.2em)");
    });

    it("Covers R16: a knob the merchant set outranks the sample", async () => {
        document.body.style.setProperty("--frak-amb-accent", "rgb(1, 2, 3)");
        const root = makeRoot();
        const track = document.createElement("div");
        document.body.append(track);
        stubRect(track, { left: 0, top: 0, width: 100, height: 100 });
        makeHostButton(track, { left: 10, top: 10, width: 200, height: 50 });

        mount({ current: root });
        await settle();

        expect(knob(root, "accent")).toBe("");
        expect(
            getComputedStyle(root).getPropertyValue("--frak-amb-accent")
        ).toBe("rgb(1, 2, 3)");
        expect(knob(root, "accent-ink")).not.toBe("");
    });

    it("keeps a light button colour for fills but sends the figures' text to the text colour", async () => {
        const root = makeRoot();
        const btn = makeHostButton(document.body, {
            left: 10,
            top: 10,
            width: 200,
            height: 50,
        });
        btn.style.cssText +=
            "; background-color: rgb(255, 225, 77); color: rgb(0, 0, 0)";

        mount({ current: root });
        await settle();

        expect(knob(root, "accent")).toBe("rgb(255, 225, 77)");
        expect(knob(root, "accent-ink")).toBe("rgb(0, 0, 0)");
        expect(knob(root, "accent-text")).toBe("currentColor");
    });

    it("leaves the figures in a readable button colour", async () => {
        const root = makeRoot();
        makeHostButton(document.body, {
            left: 10,
            top: 10,
            width: 200,
            height: 50,
        });

        mount({ current: root });
        await settle();

        expect(knob(root, "accent")).toBe(HOST_COLOR);
        expect(knob(root, "accent-text")).toBe("");
    });

    it("never reroutes the text of an accent the merchant set", async () => {
        document.body.style.setProperty(
            "--frak-amb-accent",
            "rgb(255, 240, 150)"
        );
        const root = makeRoot();
        const btn = makeHostButton(document.body, {
            left: 10,
            top: 10,
            width: 200,
            height: 50,
        });
        btn.style.backgroundColor = "rgb(255, 225, 77)";

        mount({ current: root });
        await settle();

        expect(knob(root, "accent-text")).toBe("");
    });

    it("Covers R18: writes nothing when no host button passes", async () => {
        const root = makeRoot();

        mount({ current: root });
        await settle();

        expect(knob(root, "accent")).toBe("");
        expect(knob(root, "radius")).toBe("");
    });

    it("never samples its own subtree", async () => {
        const root = makeRoot();
        const host = document.createElement("div");
        document.body.append(host);
        makeHostButton(host, { left: 10, top: 10, width: 200, height: 50 });

        mount({ current: root });
        await settle();

        expect(knob(root, "accent")).toBe(HOST_COLOR);
    });

    it("abstains when two consecutive samples disagree", async () => {
        const root = makeRoot();
        const host = document.createElement("div");
        document.body.append(host);
        const btn = makeHostButton(host, {
            left: 10,
            top: 10,
            width: 200,
            height: 50,
        });

        let reads = 0;
        Object.defineProperty(btn, "getBoundingClientRect", {
            configurable: true,
            value: () => {
                reads += 1;
                return reads === 1
                    ? domRect({ left: 10, top: 10, width: 200, height: 50 })
                    : domRect({ left: -400, top: 10, width: 200, height: 50 });
            },
        });

        mount({ current: root });
        await settle();

        expect(reads).toBeGreaterThanOrEqual(2);
        expect(knob(root, "accent")).toBe("");
    });

    it("rejects a button clipped by an overflow:hidden ancestor", async () => {
        const root = makeRoot();
        const track = document.createElement("div");
        track.style.overflow = "hidden";
        document.body.append(track);
        stubRect(track, { left: 0, top: 0, width: 100, height: 100 });
        makeHostButton(track, { left: 200, top: 10, width: 200, height: 50 });

        mount({ current: root });
        await settle();

        expect(knob(root, "accent")).toBe("");
    });

    it("does not re-sample on resize", async () => {
        const root = makeRoot();
        const host = document.createElement("div");
        document.body.append(host);
        const btn = makeHostButton(host, {
            left: 10,
            top: 10,
            width: 200,
            height: 50,
        });

        let reads = 0;
        Object.defineProperty(btn, "getBoundingClientRect", {
            configurable: true,
            value: () => {
                reads += 1;
                return domRect({ left: 10, top: 10, width: 200, height: 50 });
            },
        });

        mount({ current: root });
        await settle();
        const afterFirstPass = reads;

        window.dispatchEvent(new Event("resize"));
        await new Promise((resolve) => setTimeout(resolve, 350));

        expect(afterFirstPass).toBeGreaterThan(0);
        expect(reads).toBe(afterFirstPass);
        expect(knob(root, "accent")).toBe(HOST_COLOR);
    });

    it("never throws on a host with no background, headings or buttons", async () => {
        const root = makeRoot(false);

        mount({ current: root });
        await settle();

        expect(knob(root, "accent")).toBe("");
        expect(knob(root, "h1-size")).toBe("");
    });

    it("swallows a failure instead of breaking the merchant's page", async () => {
        const root = makeRoot(false);
        mount({ current: root });

        const broken = vi
            .spyOn(document, "querySelectorAll")
            .mockImplementation(() => {
                throw new Error("host exploded");
            });
        await settle();
        broken.mockRestore();

        expect(knob(root, "accent")).toBe("");
    });

    it("caps sampled heading sizes at the page's own maximums, in the body's em", async () => {
        const root = makeRoot();
        const h1 = document.createElement("h1");
        h1.textContent = "Their title";
        h1.style.cssText = "font-size: 90px";
        const h2 = document.createElement("h2");
        h2.textContent = "Their section";
        h2.style.cssText = "font-size: 80px";
        document.body.append(h1, h2);

        mount({ current: root });
        await settle();

        expect(knob(root, "h1-size")).toBe("min(90px, 3.2em)");
        expect(knob(root, "h2-size")).toBe("min(80px, 2em)");
    });
});
