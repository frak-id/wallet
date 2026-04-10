import { REFERRAL_SUCCESS_EVENT } from "@frak-labs/core-sdk/actions";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Banner } from "./Banner";

// Hoisted mocks for per-test control
const coreSdkMock = vi.hoisted(() => ({
    isInAppBrowser: false,
    redirectToExternalBrowser: vi.fn(),
}));

vi.mock("@frak-labs/core-sdk", () => coreSdkMock);

vi.mock("@/hooks/useClientReady", () => ({
    useClientReady: vi.fn(() => ({
        shouldRender: true,
        isHidden: false,
        isClientReady: true,
    })),
}));

vi.mock("@/hooks/usePlacement", () => ({
    usePlacement: vi.fn(() => undefined),
}));

vi.mock("@/hooks/useLightDomStyles", () => ({
    useLightDomStyles: vi.fn(),
}));

vi.mock("@/hooks/useReward", () => ({
    useReward: vi.fn(() => ({ reward: undefined })),
}));

// Import after mocks for per-test override
import * as useClientReadyHook from "@/hooks/useClientReady";
import * as usePlacementHook from "@/hooks/usePlacement";
import * as useRewardHook from "@/hooks/useReward";

// Sequential: tests mutate window event listeners and vi.mock state for
// shared hooks, incompatible with the workspace default of
// `sequence.concurrent: true`.
describe.sequential("Banner", () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        coreSdkMock.isInAppBrowser = false;
        coreSdkMock.redirectToExternalBrowser = vi.fn();

        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            shouldRender: true,
            isHidden: false,
            isClientReady: true,
        });
        vi.mocked(usePlacementHook.usePlacement).mockReturnValue(undefined);
        vi.mocked(useRewardHook.useReward).mockReturnValue({
            reward: undefined,
        });
    });

    afterEach(() => {
        cleanup();
    });

    // ─── Rendering guards ───

    it("should not render when shouldRender is false", () => {
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            shouldRender: false,
            isHidden: false,
            isClientReady: false,
        });

        const { container } = render(<Banner />);
        expect(container.querySelector(".banner")).toBeNull();
    });

    it("should not render when isHidden is true", () => {
        vi.mocked(useClientReadyHook.useClientReady).mockReturnValue({
            shouldRender: true,
            isHidden: true,
            isClientReady: true,
        });

        const { container } = render(<Banner />);
        expect(container.querySelector(".banner")).toBeNull();
    });

    it("should not render when no mode is detected", () => {
        const { container } = render(<Banner />);
        expect(container.querySelector(".banner")).toBeNull();
    });

    // ─── In-app browser mode ───

    it("should render in-app banner when isInAppBrowser is true", () => {
        coreSdkMock.isInAppBrowser = true;

        const { container } = render(<Banner />);
        const banner = container.querySelector(".banner");
        expect(banner).toBeInTheDocument();
    });

    it("should show default in-app text", () => {
        coreSdkMock.isInAppBrowser = true;

        const { container } = render(<Banner />);
        const title = container.querySelector(".banner__title");
        const cta = container.querySelector(".banner__cta");
        expect(title?.textContent).toBe("Open in your browser");
        expect(cta?.textContent).toBe("Open browser");
    });

    it("should call redirectToExternalBrowser on in-app CTA click", () => {
        coreSdkMock.isInAppBrowser = true;

        const { container } = render(<Banner />);
        const cta = container.querySelector(".banner__cta");
        if (cta) fireEvent.click(cta);

        expect(coreSdkMock.redirectToExternalBrowser).toHaveBeenCalledWith(
            window.location.href
        );
    });

    it("should show placement-configured in-app text when available", () => {
        coreSdkMock.isInAppBrowser = true;
        vi.mocked(usePlacementHook.usePlacement).mockReturnValue({
            components: {
                banner: {
                    inappTitle: "Custom title",
                    inappDescription: "Custom desc",
                    inappCta: "Custom CTA",
                },
            },
        } as any);

        const { container } = render(<Banner />);
        expect(container.querySelector(".banner__title")?.textContent).toBe(
            "Custom title"
        );
        expect(
            container.querySelector(".banner__description")?.textContent
        ).toBe("Custom desc");
        expect(container.querySelector(".banner__cta")?.textContent).toBe(
            "Custom CTA"
        );
    });

    // ─── Referral mode ───

    it("should render referral banner after frak:referral-success event", async () => {
        const { container } = render(<Banner />);

        // Initially not rendered
        expect(container.querySelector(".banner")).toBeNull();

        window.dispatchEvent(new Event(REFERRAL_SUCCESS_EVENT));

        await waitFor(() => {
            expect(container.querySelector(".banner")).toBeInTheDocument();
        });
    });

    it("should show reward text when useReward returns a reward", async () => {
        vi.mocked(useRewardHook.useReward).mockReturnValue({
            reward: "10 \u20ac",
        });
        const { container } = render(<Banner />);

        window.dispatchEvent(new Event(REFERRAL_SUCCESS_EVENT));

        await waitFor(() => {
            const title = container.querySelector(".banner__title");
            expect(title?.textContent).toContain("10 \u20ac");
        });
    });

    it("should show fallback text when useReward returns no reward", async () => {
        const { container } = render(<Banner />);

        window.dispatchEvent(new Event(REFERRAL_SUCCESS_EVENT));

        await waitFor(() => {
            const title = container.querySelector(".banner__title");
            expect(title?.textContent).toBe("You've been referred!");
        });
    });

    it("should dismiss on referral CTA click", async () => {
        const { container } = render(<Banner />);

        window.dispatchEvent(new Event(REFERRAL_SUCCESS_EVENT));

        await waitFor(() => {
            expect(container.querySelector(".banner")).toBeInTheDocument();
        });

        const cta = container.querySelector(".banner__cta");
        if (cta) fireEvent.click(cta);

        await waitFor(() => {
            expect(container.querySelector(".banner")).toBeNull();
        });
    });

    it("should show placement-configured referral text when available", async () => {
        vi.mocked(usePlacementHook.usePlacement).mockReturnValue({
            components: {
                banner: {
                    referralTitle: "Custom referral title",
                    referralDescription: "Custom referral desc",
                    referralCta: "Custom OK",
                },
            },
        } as any);

        const { container } = render(<Banner />);

        window.dispatchEvent(new Event(REFERRAL_SUCCESS_EVENT));

        await waitFor(() => {
            expect(container.querySelector(".banner__title")?.textContent).toBe(
                "Custom referral title"
            );
            expect(
                container.querySelector(".banner__description")?.textContent
            ).toBe("Custom referral desc");
            expect(container.querySelector(".banner__cta")?.textContent).toBe(
                "Custom OK"
            );
        });
    });

    // ─── Mode priority ───

    it("should prioritize in-app mode over referral event", async () => {
        coreSdkMock.isInAppBrowser = true;

        const { container } = render(<Banner />);

        // Banner is already visible in in-app mode
        expect(container.querySelector(".banner")).toBeInTheDocument();
        expect(container.querySelector(".banner__title")?.textContent).toBe(
            "Open in your browser"
        );

        // Fire referral event — should be ignored
        window.dispatchEvent(new Event(REFERRAL_SUCCESS_EVENT));

        // Still in-app mode
        await waitFor(() => {
            expect(container.querySelector(".banner__title")?.textContent).toBe(
                "Open in your browser"
            );
        });
    });

    // ─── Custom classname ───

    it("should apply classname prop to banner element", () => {
        coreSdkMock.isInAppBrowser = true;

        const { container } = render(<Banner classname="custom-class" />);
        const banner = container.querySelector(".banner");
        expect(banner).toHaveClass("custom-class");
    });

    it("should have role=alert on the banner", () => {
        coreSdkMock.isInAppBrowser = true;

        const { container } = render(<Banner />);
        const banner = container.querySelector("[role='alert']");
        expect(banner).toBeInTheDocument();
    });

    // ─── Interaction prop ───

    it("should pass interaction prop to useReward", async () => {
        const { container } = render(<Banner interaction="referral" />);

        window.dispatchEvent(new Event(REFERRAL_SUCCESS_EVENT));

        await waitFor(() => {
            expect(container.querySelector(".banner")).toBeInTheDocument();
        });

        expect(useRewardHook.useReward).toHaveBeenCalledWith(true, "referral");
    });

    it("should pass undefined interaction to useReward by default", async () => {
        const { container } = render(<Banner />);

        window.dispatchEvent(new Event(REFERRAL_SUCCESS_EVENT));

        await waitFor(() => {
            expect(container.querySelector(".banner")).toBeInTheDocument();
        });

        expect(useRewardHook.useReward).toHaveBeenCalledWith(true, undefined);
    });
});
