import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InAppBrowserToast } from "./index";

const inAppState = vi.hoisted(() => ({
    isInAppBrowser: false,
    isInIframe: false,
    isIPad: false,
}));

const sessionState = vi.hoisted(() => ({
    isDismissed: false,
    hasAttemptedRedirect: false,
    setIsDismissed: vi.fn(),
    setHasAttemptedRedirect: vi.fn(),
}));

const eventMocks = vi.hoisted(() => ({
    emitLifecycleEvent: vi.fn(),
    trackEvent: vi.fn(),
    redirectToExternalBrowser: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock("../../utils/lifecycleEvents", () => ({
    emitLifecycleEvent: eventMocks.emitLifecycleEvent,
}));

vi.mock("../../analytics", () => ({
    trackEvent: eventMocks.trackEvent,
}));

vi.mock("../../hook/useSessionFlag", () => ({
    useSessionFlag: vi.fn((key: string) => {
        if (key === "inAppBrowserToastDismissed") {
            return [
                sessionState.isDismissed,
                sessionState.setIsDismissed,
            ] as const;
        }

        return [
            sessionState.hasAttemptedRedirect,
            sessionState.setHasAttemptedRedirect,
        ] as const;
    }),
}));

vi.mock("@frak-labs/core-sdk", () => ({
    get isInAppBrowser() {
        return inAppState.isInAppBrowser;
    },
    getBackendUrl: () => "https://backend.frak.id",
    redirectToExternalBrowser: eventMocks.redirectToExternalBrowser,
}));

vi.mock("../../lib/inApp", () => ({
    get isInIframe() {
        return inAppState.isInIframe;
    },
    get isIPad() {
        return inAppState.isIPad;
    },
}));

describe("InAppBrowserToast", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        inAppState.isInAppBrowser = false;
        inAppState.isInIframe = false;
        inAppState.isIPad = false;

        sessionState.isDismissed = false;
        sessionState.hasAttemptedRedirect = false;

        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });

        Object.defineProperty(document, "execCommand", {
            configurable: true,
            value: vi.fn(() => true),
        });

        vi.spyOn(window, "alert").mockImplementation(() => {});
    });

    it("should not render when not in app browser", () => {
        const { container } = render(<InAppBrowserToast />);
        expect(container.firstChild).toBeNull();
    });

    it("should not render when dismissed", () => {
        inAppState.isInAppBrowser = true;
        sessionState.isDismissed = true;

        const { container } = render(<InAppBrowserToast />);
        expect(container.firstChild).toBeNull();
    });

    it("should render toast when in app browser and not dismissed", async () => {
        inAppState.isInAppBrowser = true;

        render(<InAppBrowserToast />);

        await waitFor(() => {
            expect(screen.getByRole("alert")).toBeInTheDocument();
        });
    });

    it("should copy parent URL with merge token on iPad iframe click", async () => {
        inAppState.isInAppBrowser = true;
        inAppState.isInIframe = true;
        inAppState.isIPad = true;

        const getMergeToken = vi.fn().mockResolvedValue("merge-token-123");
        const writeText = vi.mocked(navigator.clipboard.writeText);

        render(
            <InAppBrowserToast
                getMergeToken={getMergeToken}
                parentUrl="https://shop.example.com/products/abc"
            />
        );

        fireEvent.click(screen.getByText("wallet.inAppBrowser.cta"));

        await waitFor(() => {
            expect(writeText).toHaveBeenCalledWith(
                "https://shop.example.com/products/abc?fmt=merge-token-123"
            );
        });

        expect(eventMocks.emitLifecycleEvent).not.toHaveBeenCalled();
        expect(eventMocks.trackEvent).toHaveBeenCalledWith(
            "in_app_browser_redirected",
            { target: "sd-iframe-clipboard" }
        );
        expect(window.alert).toHaveBeenCalledWith(
            "wallet.inAppBrowser.clipboardAlert"
        );
    });

    it("should avoid lifecycle fallback on iPad iframe without parentUrl", async () => {
        inAppState.isInAppBrowser = true;
        inAppState.isInIframe = true;
        inAppState.isIPad = true;

        const writeText = vi.mocked(navigator.clipboard.writeText);

        render(<InAppBrowserToast />);

        fireEvent.click(screen.getByText("wallet.inAppBrowser.cta"));

        await waitFor(() => {
            expect(writeText).toHaveBeenCalledWith(window.location.href);
        });

        expect(eventMocks.emitLifecycleEvent).not.toHaveBeenCalled();
        expect(eventMocks.trackEvent).toHaveBeenCalledWith(
            "in_app_browser_redirected",
            { target: "sd-iframe-clipboard" }
        );
    });

    it("should show manual copy alert when clipboard write fails", async () => {
        inAppState.isInAppBrowser = true;
        inAppState.isInIframe = true;
        inAppState.isIPad = true;

        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
                writeText: vi.fn().mockRejectedValue(new Error("blocked")),
            },
        });
        Object.defineProperty(document, "execCommand", {
            configurable: true,
            value: vi.fn(() => false),
        });

        render(
            <InAppBrowserToast parentUrl="https://shop.example.com/products/abc" />
        );

        fireEvent.click(screen.getByText("wallet.inAppBrowser.cta"));

        await waitFor(() => {
            expect(window.alert).toHaveBeenCalledWith(
                "wallet.inAppBrowser.clipboardManualAlert"
            );
        });
    });
});
