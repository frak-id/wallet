import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InAppBrowserToast } from "./index";

// Mock dependencies
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock("../../../sdk/utils/lifecycleEvents", () => ({
    emitLifecycleEvent: vi.fn(),
}));

vi.mock("../../analytics", () => ({
    trackGenericEvent: vi.fn(),
}));

vi.mock("../../hook/useSessionFlag", () => ({
    useSessionFlag: vi.fn(() => [false, vi.fn()]),
}));

vi.mock("../../lib/inApp", () => ({
    isInAppBrowser: false,
    isInIframe: false,
    inAppRedirectUrl: "https://example.com/redirect",
}));

vi.mock("../Toast", () => ({
    Toast: ({ text, onClick, onDismiss }: any) => (
        <div data-testid="toast">
            <span>{text}</span>
            {onClick && (
                <button type="button" onClick={onClick}>
                    Click
                </button>
            )}
            {onDismiss && (
                <button type="button" onClick={onDismiss}>
                    Dismiss
                </button>
            )}
        </div>
    ),
}));

describe("InAppBrowserToast", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should not render when not in app browser", () => {
        const { container } = render(<InAppBrowserToast />);
        expect(container.firstChild).toBeNull();
    });

    it("should not render when dismissed", async () => {
        const { useSessionFlag } = await import("../../hook/useSessionFlag");
        vi.mocked(useSessionFlag).mockReturnValue([true, vi.fn()]); // isDismissed = true

        // Mock isInAppBrowser to be true
        const inAppModule = await import("../../lib/inApp");
        Object.defineProperty(inAppModule, "isInAppBrowser", {
            value: true,
            writable: true,
            configurable: true,
        });

        const { container } = render(<InAppBrowserToast />);
        expect(container.firstChild).toBeNull();
    });

    it("should render toast when in app browser and not dismissed", async () => {
        const { useSessionFlag } = await import("../../hook/useSessionFlag");
        vi.mocked(useSessionFlag).mockReturnValue([false, vi.fn()]); // isDismissed = false

        // Mock isInAppBrowser to be true
        const inAppModule = await import("../../lib/inApp");
        Object.defineProperty(inAppModule, "isInAppBrowser", {
            value: true,
            writable: true,
            configurable: true,
        });

        render(<InAppBrowserToast />);

        await waitFor(() => {
            expect(screen.getByTestId("toast")).toBeInTheDocument();
        });
    });
});
