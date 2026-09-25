import { cleanup, fireEvent, render, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sharingPageUtils from "@/actions/sharingPage";
import * as useClientReadyHook from "@/hooks/useClientReady";
import * as useLangHook from "@/hooks/useLang";
import { Ambassador } from "./Ambassador";

vi.mock("@/hooks/useClientReady", () => ({
    useClientReady: vi.fn(() => ({
        shouldRender: true,
        isHidden: false,
        isClientReady: true,
    })),
}));

vi.mock("@/hooks/useLang", () => ({ useLang: vi.fn(() => "en") }));

vi.mock("@/hooks/useLightDomStyles", () => ({ useLightDomStyles: vi.fn() }));

const refereeRewardImpl = vi.fn<
    (...args: unknown[]) => { reward: string | undefined; hasReward: boolean }
>(() => ({ reward: undefined, hasReward: false }));

const referrerRewardImpl = vi.fn<
    (...args: unknown[]) => { reward: string | undefined; hasReward: boolean }
>(() => ({ reward: undefined, hasReward: false }));

function setRefereeReward(reward: string | undefined, hasReward = true) {
    refereeRewardImpl.mockReturnValue({ reward, hasReward });
}
function setReferrerReward(reward: string | undefined) {
    referrerRewardImpl.mockReturnValue({ reward, hasReward: Boolean(reward) });
}
vi.mock("@/hooks/useReward", () => ({
    useReward: (...args: unknown[]) =>
        args[2] === "referrer"
            ? referrerRewardImpl(...args)
            : refereeRewardImpl(...args),
}));

vi.mock("@/actions/sharingPage", () => ({ openSharingPage: vi.fn() }));

const getInstallUrl = vi.fn();
vi.mock("@frak-labs/core-sdk/actions", () => ({
    getInstallUrl: (...args: unknown[]) => getInstallUrl(...args),
}));

vi.mock("@frak-labs/core-sdk", () => ({ sdkConfigStore: {} }));

const globalComponents = vi.fn<() => { ambassador?: Record<string, string> }>(
    () => ({})
);
vi.mock("@/hooks/useGlobalComponents", () => ({
    useGlobalComponents: () => globalComponents(),
}));
function setDashboard(ambassador: Record<string, string>) {
    globalComponents.mockReturnValue({ ambassador });
}

const encodeQR = vi.fn((_text: string, _output: string, _opts?: unknown) => [
    [true],
]);
vi.mock("qr", () => ({
    encodeQR: (text: string, output: string, opts?: unknown) =>
        encodeQR(text, output, opts),
}));

function setWideScreen(matches: boolean) {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: (media: string) => ({
            matches,
            media,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }),
    });
}

const INSTALL_URL =
    "https://wallet.frak.id/install?m=merchant-1&a=client-1#p=proof";
const BRAND = "Acme Store";
const FRAK_URL = "https://frak.id";

const REGION_CLASSES = [
    "frak-ambassador__hero",
    "frak-ambassador__reward",
    "frak-ambassador__steps",
    "frak-ambassador__win-win",
    "frak-ambassador__referral",
    "frak-ambassador__store",
    "frak-ambassador__faq",
];
const REGIONS_WITHOUT_WIN_WIN = REGION_CLASSES.filter(
    (className) => className !== "frak-ambassador__win-win"
);

function headingTexts(container: Element): string[] {
    return Array.from(container.querySelectorAll("h1, h2, h3")).map(
        (el) => el.textContent ?? ""
    );
}

function expectRegionsInOrder(
    container: Element,
    expected: string[] = REGIONS_WITHOUT_WIN_WIN
) {
    const sections = container.querySelectorAll(".frak-ambassador > section");
    expect(sections).toHaveLength(expected.length);
    const matched: string[] = [];
    sections.forEach((section, index) => {
        const className = expected[index];
        if (className && section.classList.contains(className)) {
            matched.push(className);
        }
    });
    expect(matched).toEqual(expected);
}

function text(container: Element, selector: string): string | null {
    return container.querySelector(selector)?.textContent ?? null;
}

function expectNoBannedHeadingStart(container: Element) {
    for (const text of headingTexts(container)) {
        expect(text.trim().toLowerCase()).not.toMatch(
            /^(pour|de|à|et)[\s,.;]|^,/
        );
    }
}

// Compiles the real .css.ts through the same pipeline as the build, so tests
// assert the shipped declarations rather than a hand-copied mirror. jsdom's
// realm owns globalThis.Uint8Array while esbuild's codec comes from node, so
// esbuild's import-time invariant needs both sides on node's constructor.
let compiledCssCache: Promise<string> | undefined;
function compileAmbassadorCss(): Promise<string> {
    compiledCssCache ??= (async () => {
        const nodeUint8 = new TextEncoder().encode("")
            .constructor as Uint8ArrayConstructor;
        vi.stubGlobal("Uint8Array", nodeUint8);
        try {
            const integ = await import("@vanilla-extract/integration");
            const testPath = expect.getState().testPath ?? "";
            const filePath = testPath.replace(/\.test\.tsx$/, ".css.ts");
            if (!filePath.endsWith("Ambassador.css.ts")) {
                throw new Error(`cannot locate css source from ${testPath}`);
            }
            // Class hashes include the package found from cwd, so compile from
            // the package root the component's own classes were built from.
            const compiled = await integ.compile({
                filePath,
                cwd: filePath.slice(0, filePath.lastIndexOf("/src/")),
                identOption: "debug",
            });
            const out = await integ.processVanillaFile({
                source: compiled.source,
                filePath,
                identOption: "debug",
            });
            const specifiers =
                out.match(/['"]([^'"]+\.vanilla\.css[^'"]*)['"]/g) ?? [];
            let css = "";
            for (const raw of specifiers) {
                const spec = raw.slice(1, -1);
                if (integ.virtualCssFileFilter.test(spec)) {
                    const chunk = await integ.getSourceFromVirtualCssFile(spec);
                    css += `${chunk.source}\n`;
                }
            }
            return css;
        } finally {
            vi.unstubAllGlobals();
        }
    })();
    return compiledCssCache;
}

function injectCss(css: string): HTMLStyleElement {
    const el = document.createElement("style");
    el.dataset.u6 = "";
    el.textContent = css;
    document.head.append(el);
    return el;
}

function computed(el: Element | null, prop: string): string {
    return el ? getComputedStyle(el).getPropertyValue(prop) : "<missing>";
}

describe("Ambassador", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            shouldRender: true,
            isHidden: false,
            isClientReady: true,
        });
        setReferrerReward(undefined);
        vi.mocked(useLangHook.useLang).mockReturnValue("en");
        setRefereeReward(undefined, false);
        setWideScreen(false);
        getInstallUrl.mockResolvedValue(INSTALL_URL);
        globalComponents.mockReturnValue({});
        window.FrakSetup = {
            config: { metadata: { name: BRAND } },
        } as typeof window.FrakSetup;
    });

    afterEach(() => {
        for (const el of document.querySelectorAll("style[data-u6]")) {
            el.remove();
        }
    });

    // ─── Dashboard settings ───

    it("prefers an attribute over the dashboard headline", () => {
        setDashboard({ heroTitle: "From the dashboard" });
        const { container } = render(<Ambassador heroTitle="From the tag" />);
        expect(text(container, ".frak-ambassador__hero-title")).toBe(
            "From the tag"
        );
    });

    it("shows the dashboard headline with the brand filled in", () => {
        setDashboard({ heroTitle: "Join {BRAND}", referralCtaLabel: "Go" });
        const { container } = render(<Ambassador />);
        expect(text(container, ".frak-ambassador__hero-title")).toBe(
            `Join ${BRAND}`
        );
        expect(text(container, ".frak-ambassador__referral-cta")).toBe("Go");
    });

    it("keeps the default headline when a dashboard {REWARD} headline has no figure", () => {
        setDashboard({ heroTitle: "Earn {REWARD}" });
        const { container, rerender } = render(<Ambassador />);
        expect(text(container, ".frak-ambassador__hero-title")).toBe(
            `Become an ambassador for ${BRAND}`
        );

        setReferrerReward("10 €");
        rerender(<Ambassador />);
        expect(text(container, ".frak-ambassador__hero-title")).toBe(
            "Earn 10 €"
        );
    });

    it("fills the amount slot of a dashboard reward heading", () => {
        setReferrerReward("10 €");
        setDashboard({ rewardHeading: "{REWARD} per sale" });
        const { container } = render(<Ambassador />);
        expect(text(container, ".frak-ambassador__reward-heading")).toBe(
            "10 € per sale"
        );
    });

    it("shows the dashboard hero photo, and collapses the frame when it fails", () => {
        setDashboard({ heroImageUrl: "https://merchant.example/hero.jpg" });
        const { container } = render(<Ambassador />);
        const image = container.querySelector(".frak-ambassador__hero-image");
        expect(image).toHaveAttribute(
            "src",
            "https://merchant.example/hero.jpg"
        );

        if (image) fireEvent.error(image);
        expect(
            container.querySelector(".frak-ambassador__hero-image")
        ).toBeNull();
    });

    it("replaces the whole FAQ 5 answer with the dashboard text and keeps the attribution link", () => {
        setDashboard({ faq5Answer: "{BRAND} works with Frak." });
        const { container } = render(<Ambassador />);
        const answers = container.querySelectorAll(
            ".frak-ambassador__faq-answer"
        );
        const last = answers[answers.length - 1];
        expect(last?.textContent).toBe(`${BRAND} works with Frak.`);
        expect(last?.querySelector("a")).toBeNull();
        expect(
            container.querySelector(".frak-ambassador__faq-attribution a")
        ).toHaveAttribute("href", FRAK_URL);
    });

    it("keeps the split FAQ 5 answer when a dashboard {REWARD} answer has no figure", () => {
        setDashboard({ faq5Answer: "You earn {REWARD}." });
        const { container } = render(<Ambassador />);
        expect(container.textContent).not.toContain("{REWARD}");
        expect(
            container.querySelector(".frak-ambassador__faq-answer-link")
        ).toHaveAttribute("href", FRAK_URL);
    });

    it("keeps the split FAQ 5 attributes over a dashboard answer", () => {
        setDashboard({ faq5Answer: "Dashboard answer." });
        const { container } = render(
            <Ambassador faq5AnswerBeforeLink="Run by " />
        );
        expect(container.textContent).not.toContain("Dashboard answer.");
        expect(container.textContent).toContain("Run by Frak");
    });

    // ─── Covers AE1–AE5: the referee gate ───

    it("Covers AE1. fixed rewards on both sides render seven regions in order, with both win-win figures", () => {
        setReferrerReward("10 €");
        setRefereeReward("0,80 €");

        const { container } = render(<Ambassador />);

        expectRegionsInOrder(container, REGION_CLASSES);
        const amounts = Array.from(
            container.querySelectorAll(".frak-ambassador__win-win-card-amount")
        ).map((el) => el.textContent);
        expect(amounts).toEqual(["10 €", "0,80 €"]);
        expect(text(container, ".frak-ambassador__hero-pill")).toBe(
            "+ 0,80 € for your friend"
        );
    });

    it("Covers AE2. no referee reward renders six regions, no hero pill, and perk-free step 2 and FAQ 3", () => {
        const { container } = render(<Ambassador />);

        expectRegionsInOrder(container);
        expect(
            container.querySelector(".frak-ambassador__hero-pill")
        ).toBeNull();
        const descriptions = Array.from(
            container.querySelectorAll(".frak-ambassador__step-description")
        ).map((el) => el.textContent);
        expect(descriptions[1]).toBe(
            "Credited automatically to my wallet for every sale made through my referral link."
        );
        const answers = Array.from(
            container.querySelectorAll(".frak-ambassador__faq-answer")
        ).map((el) => el.textContent);
        expect(answers[2]).toBe(
            "No. Your link doesn't change the price: your friends pay exactly what everyone else pays."
        );
        expect(container.textContent).not.toMatch(
            /cashback|perk on their order|for your friend/i
        );
    });

    it("Covers AE3. a percentage referee reward shows the win-win region and the pill in words", () => {
        setReferrerReward("10 €");
        setRefereeReward(undefined);

        const { container } = render(<Ambassador />);

        expectRegionsInOrder(container, REGION_CLASSES);
        const cards = container.querySelectorAll(
            ".frak-ambassador__win-win-card-amount"
        );
        expect(cards.item(1).textContent).toBe("A reward");
        expect(text(container, ".frak-ambassador__hero-pill")).toBe(
            "+ a perk for your friend"
        );
    });

    it("Covers AE4. a failed referee fetch renders exactly as a campaign without a referee reward", () => {
        const absent = render(<Ambassador />).container.innerHTML;
        cleanup();
        refereeRewardImpl.mockImplementation(() => {
            // useReward reports a rejected fetch as no reward (useReward.test.ts).
            return { reward: undefined, hasReward: false };
        });

        const failed = render(<Ambassador />).container.innerHTML;

        expect(failed).toBe(absent);
    });

    it("Covers AE5. the no-bank-details clause stays visible without a referee reward", () => {
        const { container } = render(<Ambassador />);

        expect(text(container, ".frak-ambassador__reward-footer")).toBe(
            "Free · no commitment · paid to your bank account · no bank details needed to start"
        );
    });

    it("drops the footer separator when a merchant blanks either clause", () => {
        const blankClause = render(<Ambassador rewardNoBankDetails="" />);

        expect(
            text(blankClause.container, ".frak-ambassador__reward-footer")
        ).toBe("Free · no commitment · paid to your bank account");
        cleanup();

        const blankCaption = render(<Ambassador rewardFooterCaption="" />);

        expect(
            text(blankCaption.container, ".frak-ambassador__reward-footer")
        ).toBe("no bank details needed to start");
    });

    it("keeps the reward region in every reward state", () => {
        const states: [string | undefined, string | undefined, boolean][] = [
            [undefined, undefined, false],
            ["10 €", undefined, false],
            ["10 €", "0,80 €", true],
            [undefined, undefined, true],
        ];
        for (const [referrer, referee, hasReferee] of states) {
            setReferrerReward(referrer);
            setRefereeReward(referee, hasReferee);

            const { container, unmount } = render(<Ambassador />);

            expect(
                container.querySelector(".frak-ambassador__reward")
            ).not.toBeNull();
            unmount();
        }
    });

    it("ignores merchant overrides of friend-perk slots without a referee reward", () => {
        const props = {
            heroRewardRefereePill: "+ a gift for your friend",
            faq3Answer: "They get a gift.",
        };
        const closed = render(<Ambassador {...props} />).container;

        expect(closed.querySelector(".frak-ambassador__hero-pill")).toBeNull();
        expect(closed.textContent).not.toContain("gift");
        cleanup();

        setRefereeReward("0,80 €");
        const open = render(<Ambassador {...props} />).container;

        expect(text(open, ".frak-ambassador__hero-pill")).toBe(
            "+ a gift for your friend"
        );
        expect(open.textContent).toContain("They get a gift.");
    });

    it("falls back to the worded pill when a {REWARD} pill override meets a percentage reward", () => {
        setRefereeReward(undefined);

        const { container } = render(
            <Ambassador heroRewardRefereePill="+ {REWARD} for them" />
        );

        expect(text(container, ".frak-ambassador__hero-pill")).toBe(
            "+ a perk for your friend"
        );
    });

    it("asks for both rewards across every campaign trigger", () => {
        render(<Ambassador />);

        expect(refereeRewardImpl).toHaveBeenCalledWith(
            true,
            undefined,
            "referee"
        );
        expect(referrerRewardImpl).toHaveBeenCalledWith(
            true,
            undefined,
            "referrer"
        );
    });

    it("fills {REWARD} with the referee amount in friend slots and the referrer amount in step 2", () => {
        setReferrerReward("10 €");
        setRefereeReward("0,80 €");

        const { container } = render(
            <Ambassador
                step2Description="You get {REWARD}."
                faq3Answer="They get {REWARD}."
                winWinCard2Description="{REWARD} off their order."
            />
        );

        expect(container.textContent).toContain("You get 10 €.");
        expect(container.textContent).toContain("They get 0,80 €.");
        expect(container.textContent).toContain("0,80 € off their order.");
    });

    it("falls back to the default step 2 copy when a {REWARD} override has no figure", () => {
        setRefereeReward(undefined);

        const { container } = render(
            <Ambassador step2Description="Your friend gets {REWARD}." />
        );

        expect(container.textContent).not.toContain("Your friend gets .");
        expect(container.textContent).toContain(
            "Credited automatically to my wallet for every sale made through my referral link."
        );
    });

    // ─── Referral block ───

    it("the referral button opens the sharing page and the block has no link text or copy control", () => {
        const { container } = render(<Ambassador />);
        const block = container.querySelector(".frak-ambassador__referral");

        expect(block?.querySelectorAll("button")).toHaveLength(1);
        expect(block?.querySelector("input, a")).toBeNull();
        expect(block?.textContent).not.toMatch(/copy|https?:\/\//i);
        expect(text(container, ".frak-ambassador__referral-lede")).toBe(
            "Finally, a referral program that really pays!"
        );

        const cta = container.querySelector(".frak-ambassador__referral-cta");
        expect(cta?.textContent).toBe("Share my link");
        if (cta) fireEvent.click(cta);
        expect(sharingPageUtils.openSharingPage).toHaveBeenCalledTimes(1);
    });

    it("Covers WCAG 2.4.7. the referral button paints the dual-band focus ring", async () => {
        injectCss(await compileAmbassadorCss());
        const { container } = render(<Ambassador />);
        const cta = container.querySelector<HTMLElement>(
            ".frak-ambassador__referral-cta"
        );

        fireEvent.keyDown(document.body, { key: "Tab" });
        cta?.focus();
        expect(document.activeElement).toBe(cta);

        expect(computed(cta, "outline-color")).toBe("rgb(0, 0, 0)");
        expect(computed(cta, "box-shadow")).toContain("2px #fff");
    });

    // ─── 2026-09-15 R3: renders fully with no session ───

    it("2026-09-15 R3. renders every region with no wallet session", () => {
        const { container } = render(<Ambassador />);

        expectRegionsInOrder(container);
        expect(container.textContent).toContain("Ambassador program");
    });

    it("2026-09-15 R3. renders every region before backend config resolves, with every share CTA disabled", () => {
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            shouldRender: false,
            isHidden: false,
            isClientReady: false,
        });

        const { container } = render(<Ambassador />);

        expectRegionsInOrder(container);
        expect(
            container.querySelector(".frak-ambassador__hero-cta")
        ).toBeDisabled();
        expect(
            container.querySelector(".frak-ambassador__referral-cta")
        ).toBeDisabled();
        expect(
            container.querySelector(".frak-ambassador__store-badge--app")
        ).not.toHaveAttribute("href");
        expect(
            container.querySelector(".frak-ambassador__store-badge--play")
        ).not.toHaveAttribute("href");
    });

    it("does not render when isHidden is true", () => {
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            shouldRender: true,
            isHidden: true,
            isClientReady: true,
        });

        const { container } = render(<Ambassador />);
        expect(container.querySelector(".frak-ambassador")).toBeNull();
    });

    // ─── 2026-09-15 AE1: reward amount resolves ───

    it("2026-09-15 AE1. renders the reward amount in the hero and the reward heading when a fixed-payout campaign resolves", () => {
        setReferrerReward("10 €");

        const { container } = render(<Ambassador />);

        expect(
            container.querySelector(".frak-ambassador__hero-amount")
                ?.textContent
        ).toBe("10 €");
        const rewardHeading = container.querySelector(
            ".frak-ambassador__reward-heading"
        );
        expect(rewardHeading?.textContent).toBe("10 € for you on every sale");
        expect(
            rewardHeading?.querySelector(".frak-ambassador__reward-amount")
                ?.textContent
        ).toBe("10 €");
        expect(
            container.querySelector(".frak-ambassador__hero-title")?.textContent
        ).toBe("Become an ambassador for Acme Store");
    });

    // ─── 2026-09-15 AE2: no-reward copy, no invented amount ───

    it("2026-09-15 AE2. renders every region with no-reward copy when no reward resolves and invents no amount", () => {
        const { container } = render(<Ambassador />);

        expectRegionsInOrder(container);
        const rewardHeading = container.querySelector(
            ".frak-ambassador__reward-heading"
        );
        expect(rewardHeading?.textContent).toBe(
            "A reward for you on every sale"
        );
        expect(rewardHeading?.textContent).not.toMatch(/\d/);
        expect(
            container.querySelector(".frak-ambassador__hero-amount")
                ?.textContent
        ).toBe("A reward");
        expect(
            container.querySelector(".frak-ambassador__hero-title")?.textContent
        ).toBe("Become an ambassador for Acme Store");
        expect(container.textContent).not.toContain("{REWARD}");
        expect(container.textContent).not.toContain("{BRAND}");
    });

    it("puts the amount in the hero intro, and says a reward when no amount resolves", () => {
        const { container, rerender } = render(<Ambassador />);
        expect(text(container, ".frak-ambassador__hero-lede")).toBe(
            "Love our products? Tell the people around you! Earn a reward as soon as someone buys thanks to you."
        );

        setReferrerReward("10 €");
        rerender(<Ambassador />);
        expect(text(container, ".frak-ambassador__hero-lede")).toBe(
            "Love our products? Tell the people around you! Earn 10 € as soon as someone buys thanks to you."
        );
        expect(text(container, ".frak-ambassador__hero-title")).toBe(
            "Become an ambassador for Acme Store"
        );
    });

    it("renders the referee pill only when a referee reward resolves", () => {
        const withoutPill = render(<Ambassador />);
        expect(withoutPill.container.textContent).not.toContain(
            "for your friend"
        );
        withoutPill.unmount();

        setRefereeReward("0,80 €");
        const withPill = render(<Ambassador />);
        expect(
            withPill.container.querySelector(".frak-ambassador__hero-pill")
                ?.textContent
        ).toBe("+ 0,80 € for your friend");
    });

    // ─── 2026-09-15 AE4: no progress affordance ───

    it("2026-09-15 AE4. marks no step complete and renders no progress affordance", () => {
        const { container } = render(<Ambassador />);

        expect(container.querySelectorAll("[aria-current]")).toHaveLength(0);
        expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(
            0
        );
        const stepTitles = Array.from(
            container.querySelectorAll(".frak-ambassador__step-title")
        ).map((el) => el.textContent);
        expect(stepTitles).toEqual([
            "I share with the people close to me",
            "I get paid",
            "I collect my money",
        ]);
    });

    it("drops a {REWARD} override for the default copy until a figure fills it", () => {
        const props = {
            heroTitle: "Earn {REWARD} with {BRAND}.",
            rewardHeading: "{REWARD} per friend.",
            faq1Answer: "You get {REWARD}.",
        };
        const { container, rerender } = render(<Ambassador {...props} />);

        expect(text(container, ".frak-ambassador__hero-title")).toBe(
            `Become an ambassador for ${BRAND}`
        );
        expect(text(container, ".frak-ambassador__reward-heading")).toBe(
            "A reward for you on every sale"
        );
        expect(
            container.querySelector(".frak-ambassador__faq-answer")?.textContent
        ).not.toContain("{REWARD}");
        expect(container.textContent).not.toMatch(/Earn\s+with|get \./);

        setReferrerReward("9\u00A0€");
        rerender(<Ambassador {...props} />);
        expect(text(container, ".frak-ambassador__hero-title")).toBe(
            `Earn 9\u00A0€ with ${BRAND}.`
        );
        expect(text(container, ".frak-ambassador__reward-heading")).toBe(
            "9\u00A0€ per friend."
        );
    });

    // ─── 2026-09-15 AE5: single prop override ───

    it("2026-09-15 AE5. uses a supplied heroTitle prop and the default-language string for every other slot", () => {
        const { container } = render(
            <Ambassador heroTitle="Custom headline" />
        );

        expect(
            container.querySelector(".frak-ambassador__hero-title")?.textContent
        ).toBe("Custom headline");
        expect(
            container.querySelector(".frak-ambassador__reward-heading")
                ?.textContent
        ).toBe("A reward for you on every sale");
        expect(text(container, ".frak-ambassador__referral-title")).toBe(
            "Your ambassador link"
        );
        expect(
            container.querySelector(".frak-ambassador__faq-title")?.textContent
        ).toBe("Frequently asked questions");
        expect(
            container.querySelector(".frak-ambassador__store-title")
                ?.textContent
        ).toBe("Track your earnings in real time");
    });

    // ─── 2026-09-15 R9: share handoffs ───

    it("2026-09-15 R9. calls openSharingPage when the hero CTA is clicked", () => {
        const { container } = render(<Ambassador />);
        const cta = container.querySelector(".frak-ambassador__hero-cta");
        if (cta) fireEvent.click(cta);

        expect(sharingPageUtils.openSharingPage).toHaveBeenCalledTimes(1);
    });

    it("calls openSharingPage when the reward region CTA is clicked", () => {
        const { container } = render(<Ambassador />);
        const cta = container.querySelector(".frak-ambassador__reward-cta");
        if (cta) fireEvent.click(cta);

        expect(sharingPageUtils.openSharingPage).toHaveBeenCalledTimes(1);
    });

    it("does not call openSharingPage when clicked while the client is not ready", () => {
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            shouldRender: true,
            isHidden: false,
            isClientReady: false,
        });
        const { container } = render(<Ambassador />);
        const cta = container.querySelector(".frak-ambassador__hero-cta");
        if (cta) fireEvent.click(cta);

        expect(sharingPageUtils.openSharingPage).not.toHaveBeenCalled();
    });

    // ─── 2026-09-15 R15 / R10: store badges ───

    it("builds the install link from the merchant-id attribute, else lets the SDK resolve it", async () => {
        render(<Ambassador merchantId="merchant-1" />);
        render(<Ambassador />);

        await waitFor(() => expect(getInstallUrl).toHaveBeenCalledTimes(2));
        expect(getInstallUrl).toHaveBeenCalledWith({
            merchantId: "merchant-1",
        });
        expect(getInstallUrl).toHaveBeenCalledWith({ merchantId: undefined });
    });

    it("2026-09-15 R15. renders both store badges with the same href once the install URL resolves", async () => {
        const { container } = render(<Ambassador merchantId="merchant-1" />);

        await waitFor(() => {
            expect(
                container.querySelector(".frak-ambassador__store-badge--app")
            ).toHaveAttribute("href", INSTALL_URL);
            expect(
                container.querySelector(".frak-ambassador__store-badge--play")
            ).toHaveAttribute("href", INSTALL_URL);
        });
        for (const badge of container.querySelectorAll(
            ".frak-ambassador__store-badge"
        )) {
            expect(badge).not.toHaveAttribute("aria-disabled");
            expect(badge).not.toHaveAttribute("role");
            expect(badge).not.toHaveAttribute("tabindex");
        }
    });

    it("2026-09-15 R10. renders both badges visible, focusable and announced as disabled links when no install URL can be built", async () => {
        getInstallUrl.mockResolvedValue(undefined);
        const { container } = render(<Ambassador merchantId="merchant-1" />);

        await waitFor(() => {
            expect(getInstallUrl).toHaveBeenCalled();
        });

        const appBadge = container.querySelector(
            ".frak-ambassador__store-badge--app"
        );
        const playBadge = container.querySelector(
            ".frak-ambassador__store-badge--play"
        );
        expect(appBadge).toBeInTheDocument();
        expect(playBadge).toBeInTheDocument();
        expect(appBadge).not.toHaveAttribute("href");
        expect(playBadge).not.toHaveAttribute("href");
        for (const badge of [appBadge, playBadge]) {
            expect(badge).toHaveAttribute("role", "link");
            expect(badge).toHaveAttribute("tabindex", "0");
            expect(badge).toHaveAttribute("aria-disabled", "true");
        }
    });

    it("reports a failed install link build instead of rejecting on the merchant's page", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        getInstallUrl.mockRejectedValue(new Error("storage refused"));
        const { container } = render(<Ambassador merchantId="merchant-1" />);

        await waitFor(() => expect(error).toHaveBeenCalled());

        expect(
            container.querySelector(".frak-ambassador__store-badge--app")
        ).not.toHaveAttribute("href");
        error.mockRestore();
    });

    it("Covers AE6. on a wide screen the store block shows a QR encoding the badges' install link", async () => {
        setWideScreen(true);
        const { container } = render(<Ambassador merchantId="merchant-1" />);

        const qr = await waitFor(() => {
            const svg = container.querySelector(
                ".frak-ambassador__store .frak-ambassador__store-qr svg"
            );
            expect(svg).not.toBeNull();
            return svg;
        });

        expect(qr).toHaveAttribute("role", "img");
        expect(qr).toHaveAttribute(
            "aria-label",
            "QR code to install the Frak app"
        );
        expect(text(container, ".frak-ambassador__store-qr-caption")).toBe(
            "Scan to install"
        );
        const badgeHref = container
            .querySelector(".frak-ambassador__store-badge--app")
            ?.getAttribute("href");
        expect(encodeQR).toHaveBeenLastCalledWith(
            badgeHref,
            "raw",
            expect.anything()
        );
        expect(badgeHref).toBe(INSTALL_URL);
    });

    it("applies the store-qr-label and store-qr-caption overrides to the QR", async () => {
        setWideScreen(true);
        const { container } = render(
            <Ambassador
                merchantId="merchant-1"
                storeQrLabel="Install {BRAND}"
                storeQrCaption="Point your camera"
            />
        );

        const qr = await waitFor(() => {
            const svg = container.querySelector(
                ".frak-ambassador__store-qr svg"
            );
            expect(svg).not.toBeNull();
            return svg;
        });

        expect(qr).toHaveAttribute("aria-label", `Install ${BRAND}`);
        expect(text(container, ".frak-ambassador__store-qr-caption")).toBe(
            "Point your camera"
        );
    });

    it("Covers AE6. on a phone the store block shows the badges and never loads the encoder", async () => {
        const { container } = render(<Ambassador merchantId="merchant-1" />);

        await waitFor(() =>
            expect(
                container.querySelector(".frak-ambassador__store-badge--app")
            ).toHaveAttribute("href", INSTALL_URL)
        );
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(
            container.querySelector(".frak-ambassador__store-qr")
        ).toBeNull();
        expect(encodeQR).not.toHaveBeenCalled();
    });

    it.each([
        {
            lang: "en",
            appLabel: "Download on the App Store",
            appViewBox: "0 0 119.66407 40",
            playLabel: "Get it on Google Play",
            playSize: ["564", "168"],
        },
        {
            lang: "fr",
            appLabel: "Télécharger dans l’App Store",
            appViewBox: "0 0 126.50751 40",
            playLabel: "Disponible sur Google Play",
            playSize: ["646", "192"],
        },
    ] as const)(
        "renders the vendors' $lang badge art with a matching accessible name",
        ({ lang, appLabel, appViewBox, playLabel, playSize }) => {
            vi.mocked(useLangHook.useLang).mockReturnValue(lang);
            const { container } = render(<Ambassador />);

            const appBadge = container.querySelector(
                ".frak-ambassador__store-badge--app"
            );
            expect(appBadge).toHaveAttribute("aria-label", appLabel);
            expect(appBadge?.querySelector("svg")).toHaveAttribute(
                "viewBox",
                appViewBox
            );
            expect(appBadge?.textContent).toBe("");

            const playBadge = container.querySelector(
                ".frak-ambassador__store-badge--play"
            );
            expect(playBadge).toHaveAttribute("aria-label", playLabel);
            const playArt = playBadge?.querySelector("img");
            expect(playArt).toHaveAttribute(
                "src",
                expect.stringContaining("data:image/png;base64,")
            );
            expect(playArt).toHaveAttribute("width", playSize[0]);
            expect(playArt).toHaveAttribute("height", playSize[1]);
        }
    );

    // ─── L hero frame and numbered steps ───

    it("collapses the hero frame around the reward card and numbers the steps when no image urls are supplied", () => {
        const { container } = render(<Ambassador />);

        const art = container.querySelector(".frak-ambassador__hero-art");
        expect(art?.classList).not.toContain(
            "frak-ambassador__hero-art--framed"
        );
        expect(
            container.querySelector(".frak-ambassador__hero-image")
        ).toBeNull();
        expect(
            Array.from(
                container.querySelectorAll(".frak-ambassador__step-number")
            ).map((el) => el.textContent)
        ).toEqual(["1", "2", "3"]);
    });

    it("frames a merchant hero photo, and collapses the frame when it fails to load", () => {
        const { container } = render(
            <Ambassador heroImageUrl="https://merchant.example/gone.png" />
        );
        const art = () => container.querySelector(".frak-ambassador__hero-art");
        expect(art()?.classList).toContain("frak-ambassador__hero-art--framed");

        fireEvent.error(
            container.querySelector(
                "img.frak-ambassador__hero-image"
            ) as Element
        );

        expect(
            container.querySelector(".frak-ambassador__hero-image")
        ).toBeNull();
        expect(art()?.classList).not.toContain(
            "frak-ambassador__hero-art--framed"
        );
    });

    it("draws the currency smaller beside the reward figures and leaves worded fallbacks whole", () => {
        setReferrerReward("7,20\u00A0€");
        setRefereeReward("$0.80");
        const { container } = render(<Ambassador />);

        const amount = container.querySelector(
            ".frak-ambassador__reward-amount"
        );
        expect(amount?.textContent).toBe("7,20\u00A0€");
        expect(
            amount?.querySelector(".frak-ambassador__amount-unit")?.textContent
        ).toBe("\u00A0€");
        const friend = container.querySelectorAll(
            ".frak-ambassador__win-win-card-amount"
        )[1];
        expect(
            friend?.querySelector(".frak-ambassador__amount-unit")?.textContent
        ).toBe("$");
        cleanup();

        setReferrerReward(undefined);
        const { container: worded } = render(<Ambassador />);
        expect(
            worded.querySelector(
                ".frak-ambassador__reward-amount .frak-ambassador__amount-unit"
            )
        ).toBeNull();
        expect(
            worded.querySelector(".frak-ambassador__amount-words")?.textContent
        ).toBe("A reward");
    });

    it("renders merchant-supplied images with alt text in place of the empty frame and the step number", () => {
        const { container } = render(
            <Ambassador
                heroImageUrl="https://merchant.example/hero.png"
                step1ImageUrl="https://merchant.example/step1.png"
                step1ImageAlt="Sharing the link"
            />
        );

        const heroImage = container.querySelector(
            ".frak-ambassador__hero-image"
        );
        expect(heroImage?.tagName).toBe("IMG");
        expect(heroImage).toHaveAttribute(
            "src",
            "https://merchant.example/hero.png"
        );
        expect(heroImage).toHaveAttribute("alt", "Acme Store ambassadors");

        const stepImage = container.querySelector(
            ".frak-ambassador__step-icon"
        );
        expect(stepImage?.tagName).toBe("IMG");
        expect(stepImage).toHaveAttribute("alt", "Sharing the link");
    });

    // ─── Content-spec invariants: headings, brand, anchors ───

    it("renders the exact text of every heading in the no-reward state", () => {
        const { container } = render(<Ambassador />);

        expect(headingTexts(container)).toEqual([
            "Become an ambassador for Acme Store",
            "A reward for you on every sale",
            "How it works",
            "I share with the people close to me",
            "I get paid",
            "I collect my money",
            "Your ambassador link",
            "Track your earnings in real time",
            "Frequently asked questions",
        ]);
        expectNoBannedHeadingStart(container);
    });

    it("renders the exact text of every heading in the reward state", () => {
        setReferrerReward("10 €");
        setRefereeReward("0,80 €");

        const { container } = render(<Ambassador />);

        expect(headingTexts(container)).toEqual([
            "Become an ambassador for Acme Store",
            "10 € for you on every sale",
            "How it works",
            "I share with the people close to me",
            "I get paid",
            "I collect my money",
            "Your friends win too",
            "Your ambassador link",
            "Track your earnings in real time",
            "Frequently asked questions",
        ]);
        expectNoBannedHeadingStart(container);
    });

    it("mentions the merchant brand twice, three times with the win-win region, and never leaks the demo name", () => {
        const brandMentions = () => {
            const visible =
                document.querySelector(".frak-ambassador")?.textContent ?? "";
            expect(visible).not.toContain("Vanilla JS");
            return visible.split(BRAND).length - 1;
        };
        render(<Ambassador />);
        expect(brandMentions()).toBe(2);
        cleanup();

        setRefereeReward("0,80 €");
        render(<Ambassador />);
        expect(brandMentions()).toBe(3);
    });

    it("renders step titles as h3 headings, not paragraphs", () => {
        const { container } = render(<Ambassador />);

        const stepTitles = container.querySelectorAll(
            ".frak-ambassador__step-title"
        );
        expect(stepTitles).toHaveLength(3);
        for (const title of stepTitles) {
            expect(title.tagName).toBe("H3");
        }
    });

    it("keeps the two frak.id links as real underlined anchors inside the copy", () => {
        const { container } = render(<Ambassador />);

        const links = container.querySelectorAll("a.frak-link");
        expect(links).toHaveLength(2);
        for (const link of links) {
            expect(link).toHaveAttribute("href", FRAK_URL);
            expect(link).toHaveAttribute("target", "_blank");
            expect(link).toHaveAttribute("rel", "noopener");
        }
        const faqAnswer = container.querySelector(
            ".frak-ambassador__faq-answer-link"
        );
        expect(faqAnswer).toBeInTheDocument();
        expect(faqAnswer?.parentElement?.textContent).toBe(
            "The partner that handles referral tracking and payouts for Acme Store. Frak never sells any data to third parties."
        );
    });

    it("closes on the frak attribution with no shop CTA", () => {
        const { container } = render(<Ambassador />);

        expect(
            container.querySelector(".frak-ambassador__faq-shop-cta")
        ).toBeNull();
        const attribution = container.querySelector(
            ".frak-ambassador__faq-attribution"
        );
        expect(attribution?.textContent).toBe("Program powered by Frak");
        expect(attribution?.querySelector("a.frak-link")).not.toBeNull();
    });

    it("renders five FAQ pairs with the first entry open", () => {
        const { container } = render(<Ambassador />);

        const items = container.querySelectorAll(".frak-ambassador__faq-item");
        expect(items).toHaveLength(5);
        const summaries = Array.from(
            container.querySelectorAll(".frak-ambassador__faq-question")
        ).map((el) => el.textContent);
        expect(summaries).toEqual([
            "Is it really free?",
            "When do I get my money?",
            "Do my friends pay more with my link?",
            "Do I need to be an influencer?",
            "What is Frak?",
        ]);
        expect(items.item(0)).toHaveAttribute("open");
        expect(items.item(1)).not.toHaveAttribute("open");
    });

    // ─── Brand resolution ───

    it("falls back to the bare hostname when the SDK config carries no merchant name", () => {
        window.FrakSetup = { config: {} } as typeof window.FrakSetup;

        const { container } = render(<Ambassador />);

        const hostname = window.location.hostname;
        expect(
            container.querySelector(".frak-ambassador__hero-title")?.textContent
        ).toBe(`Become an ambassador for ${hostname}`);
    });

    it("escapes nothing and renders a merchant name containing replacement metacharacters literally", () => {
        window.FrakSetup = {
            config: { metadata: { name: "A&B $& $$ <shop>" } },
        } as typeof window.FrakSetup;

        const { container } = render(<Ambassador />);

        expect(
            container.querySelector(".frak-ambassador__hero-title")?.textContent
        ).toBe("Become an ambassador for A&B $& $$ <shop>");
    });

    // ─── R19: renders in the merchant's language ───

    it("Renders in French with French headings and a fr lang attribute when useLang resolves fr", () => {
        vi.mocked(useLangHook.useLang).mockReturnValue("fr");

        const { container } = render(<Ambassador />);

        expect(container.querySelector(".frak-ambassador")).toHaveAttribute(
            "lang",
            "fr"
        );
        expect(headingTexts(container)).toEqual([
            "Devenez ambassadeur Acme Store",
            "Une récompense pour vous à chaque vente",
            "Comment ça marche",
            "Je partage à mes proches",
            "Je reçois de l’argent",
            "Je récupère mon argent",
            "Votre lien d’ambassadeur",
            "Suivez vos gains en temps réel",
            "Questions fréquentes",
        ]);
        expectNoBannedHeadingStart(container);
        const visible =
            container.querySelector(".frak-ambassador")?.textContent ?? "";
        expect(visible.split(BRAND).length - 1).toBe(2);
    });

    it("renders an en lang attribute for the default language", () => {
        const { container } = render(<Ambassador />);

        expect(container.querySelector(".frak-ambassador")).toHaveAttribute(
            "lang",
            "en"
        );
    });

    // ─── 2026-09-15 AE6 / R16 / R17: theming knobs + badge cascade lock ───

    it("2026-09-15 AE6. keeps the badge lockups white-on-black under a reboot rule forcing color: inherit on hrefless anchors", async () => {
        getInstallUrl.mockResolvedValue(undefined);
        injectCss(await compileAmbassadorCss());
        injectCss(
            "a:not([href]) { color: inherit; background-color: rgb(40,40,40); }"
        );
        const { container } = render(<Ambassador merchantId="merchant-1" />);

        await waitFor(() => expect(getInstallUrl).toHaveBeenCalled());
        const badge = container.querySelector(".frak-ambassador__store-badge");
        expect(badge).not.toHaveAttribute("href");
        expect(computed(badge, "color")).toBe("rgb(255, 255, 255)");
        expect(computed(badge, "background-color")).toBe("rgb(0, 0, 0)");
    });

    it("2026-09-15 R16. surface and border tints follow the accent where color-mix is supported, and stay neutral elsewhere", async () => {
        const css = (await compileAmbassadorCss()).replace(/\s+/g, " ");

        expect(css).toContain(
            "@supports (color: color-mix(in srgb, red 4%, transparent))"
        );
        expect(css).toContain(
            "var(--frak-amb-surface, color-mix(in srgb, var(--frak-amb-accent, #111) 4%, transparent))"
        );
        expect(css).toContain(
            "var(--frak-amb-border, color-mix(in srgb, var(--frak-amb-accent, #111) 15%, transparent))"
        );
        expect(css).toContain("var(--frak-amb-surface, rgba(17,17,17,.04))");
        expect(css).toContain("var(--frak-amb-border, rgba(17,17,17,.15))");
    });

    it("2026-09-15 R16. an ancestor's --frak-amb-accent reaches the figures and the CTA without touching any class", async () => {
        injectCss(await compileAmbassadorCss());
        const { container } = render(<Ambassador />);

        const amount = container.querySelector(
            ".frak-ambassador__reward-amount"
        );
        const cta = container.querySelector(".frak-ambassador__hero-cta");
        expect(computed(amount, "color")).toContain("--frak-amb-accent");
        expect(computed(amount, "color")).toContain("#111");
        expect(computed(cta, "background-color")).toContain(
            "--frak-amb-cta-bg"
        );

        if (container instanceof HTMLElement) {
            container.style.setProperty("--frak-amb-accent", "rgb(255,0,0)");
        }
        expect(
            getComputedStyle(amount ?? container).getPropertyValue(
                "--frak-amb-accent"
            )
        ).toBe("rgb(255,0,0)");
        expect(
            getComputedStyle(cta ?? container).getPropertyValue(
                "--frak-amb-accent"
            )
        ).toBe("rgb(255,0,0)");
    });

    it("2026-09-15 R16. an unset knob falls back to its documented default", async () => {
        injectCss(await compileAmbassadorCss());
        setRefereeReward("0,80 €");
        const { container } = render(<Ambassador />);

        const tag = container.querySelector(".frak-ambassador__hero-tag");
        expect(computed(tag, "background-color")).toContain(
            "--frak-amb-tag-bg"
        );
        expect(computed(tag, "background-color")).toContain("#fff");
        const card = container.querySelector(".frak-ambassador__win-win-card");
        expect(computed(card, "background-color")).toContain(
            "--frak-amb-surface"
        );
        expect(computed(card, "background-color")).toContain(
            "rgba(17,17,17,.04)"
        );
        expect(computed(card, "border-radius")).toContain("--frak-amb-radius");
    });

    it("2026-09-15 R17. the badge lock does not leak: a merchant class still overrides the hero and card colours", async () => {
        injectCss(await compileAmbassadorCss());
        injectCss(
            ".frak-ambassador__hero-title { color: rgb(200,50,50); }\n" +
                ".frak-ambassador__win-win-card { background-color: rgb(0,128,0); }"
        );
        setRefereeReward("0,80 €");
        const { container } = render(<Ambassador />);

        expect(
            computed(
                container.querySelector(".frak-ambassador__hero-title"),
                "color"
            )
        ).toBe("rgb(200, 50, 50)");
        expect(
            computed(
                container.querySelector(".frak-ambassador__win-win-card"),
                "background-color"
            )
        ).toBe("rgb(0, 128, 0)");
    });

    it("Covers WCAG 2.4.7. the badge focus ring is black outside and white inside", async () => {
        const css = await compileAmbassadorCss();
        const rule =
            css.match(/storeBadge[^{}]*:focus-visible\s*\{[^}]*\}/)?.[0] ??
            "<missing focus rule>";

        const outline = rule.match(/outline-color:\s*([^;]+);/)?.[1] ?? "";
        const shadow = rule.match(/box-shadow:\s*([^;]+);/)?.[1] ?? "";
        expect(outline.trim()).toBe("#000");
        expect(shadow.trim()).toBe("0 0 0 2px #fff");
    });

    it("Covers WCAG 2.4.7. every filled CTA gets the same ring, not just the badge", async () => {
        const css = await compileAmbassadorCss();
        const rule =
            css.match(/ctaButton[^{}]*:focus-visible\s*\{[^}]*\}/)?.[0] ??
            "<missing focus rule>";

        const outline = rule.match(/outline-color:\s*([^;]+);/)?.[1] ?? "";
        const shadow = rule.match(/box-shadow:\s*([^;]+);/)?.[1] ?? "";
        expect(outline.trim()).toBe("#000");
        expect(shadow.trim()).toBe("0 0 0 2px #fff");
    });

    it("Covers WCAG 2.4.7. focusing the badge paints both rings resolved", async () => {
        getInstallUrl.mockResolvedValue(
            "https://wallet.frak.id/install?m=merchant-1"
        );
        injectCss(await compileAmbassadorCss());
        const { container } = render(<Ambassador merchantId="merchant-1" />);
        const badge = container.querySelector(".frak-ambassador__store-badge");
        await waitFor(() => expect(badge).toHaveAttribute("href"));

        // A Tab keydown before focus is what makes :focus-visible match a link.
        fireEvent.keyDown(document.body, { key: "Tab" });
        (badge as HTMLElement | null)?.focus();
        expect(document.activeElement).toBe(badge);

        expect(computed(badge, "outline-color")).toBe("rgb(0, 0, 0)");
        expect(computed(badge, "box-shadow")).toContain("2px #fff");
    });

    it("colours the reward figure through the accent-text knob, falling back to the accent", async () => {
        injectCss(await compileAmbassadorCss());
        setReferrerReward("9\u00A0€");
        const { container } = render(<Ambassador />);

        const amount = container.querySelector(
            ".frak-ambassador__reward-amount"
        );
        expect(computed(amount, "color")).toContain("--frak-amb-accent-text");
        expect(computed(amount, "color")).toContain("--frak-amb-accent,");
    });

    it("2026-09-15 R16. a typography knob reaches its consumer and falls back when unset", async () => {
        injectCss(await compileAmbassadorCss());
        const { container } = render(<Ambassador />);

        const title = container.querySelector(".frak-ambassador__hero-title");
        const cta = container.querySelector(".frak-ambassador__hero-cta");
        expect(computed(title, "font-size")).toContain("--frak-amb-h1-size");
        expect(computed(title, "font-size")).toContain(
            "clamp(2em, 4.6vw, 3.2em)"
        );
        expect(computed(cta, "font-size")).toContain("--frak-amb-cta-size");
        expect(computed(cta, "font-size")).toContain("0.9em");
        expect(computed(cta, "text-transform")).toContain(
            "--frak-amb-cta-transform"
        );

        if (container instanceof HTMLElement) {
            container.style.setProperty("--frak-amb-h1-size", "34px");
            container.style.setProperty("--frak-amb-cta-size", "18px");
        }
        expect(
            getComputedStyle(title ?? container).getPropertyValue(
                "--frak-amb-h1-size"
            )
        ).toBe("34px");
        expect(
            getComputedStyle(cta ?? container).getPropertyValue(
                "--frak-amb-cta-size"
            )
        ).toBe("18px");
    });
});
