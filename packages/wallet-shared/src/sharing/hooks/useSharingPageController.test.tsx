import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    type SharingOutcomes,
    type SharingPageControllerInput,
    useSharingPageController,
} from "./useSharingPageController";

vi.mock("../../common/analytics", () => ({
    trackEvent: vi.fn(),
}));

const copy = vi.fn();
vi.mock("../../common/hook/useCopyToClipboardWithState", () => ({
    useCopyToClipboardWithState: () => ({ copy }),
}));

vi.mock("../../common/hook/useFormattedEstimatedReward", () => ({
    useFormattedEstimatedReward: () => ({ data: undefined, isLoading: false }),
}));

const triggerSharing = vi.fn();
vi.mock("./useShareLink", () => ({
    useShareLink: () => ({
        mutate: triggerSharing,
        isPending: false,
        canShare: false,
    }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

// Real UUIDs: `FrakContextManager` validates these, and a short stand-in makes
// `buildSharingLink` return null, which silently disables share and copy.
const merchantId = "550e8400-e29b-41d4-a716-446655440000";
const clientId = "550e8400-e29b-41d4-a716-446655440001";

function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
}

function setup(
    outcomes: Partial<SharingOutcomes> = {},
    input: Partial<SharingPageControllerInput> = {}
) {
    const dismiss = vi.fn();
    const install = vi.fn();
    const result = renderHook(
        () =>
            useSharingPageController({
                merchantId,
                clientId,
                link: "https://acme.example/kettle",
                merchant: { name: "Acme" },
                source: "sharing_page_wallet",
                installUrl: null,
                chrome: { mode: "full" },
                t: (key) => key,
                ...input,
                outcomes: { dismiss, install, ...outcomes },
            }),
        { wrapper }
    );
    return { ...result, dismiss, install };
}

beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
});

describe("outcome hand-off", () => {
    it("does not share locally when the host takes the share", () => {
        const share = vi.fn(() => true);
        const { result } = setup({ share });

        act(() => result.current.actions.onShare());

        expect(share).toHaveBeenCalled();
        expect(triggerSharing).not.toHaveBeenCalled();
    });

    it("shares locally when the host declines it", () => {
        const share = vi.fn(() => false);
        const { result } = setup({ share });

        act(() => result.current.actions.onShare());

        expect(triggerSharing).toHaveBeenCalled();
    });

    it("does not write the clipboard when the host takes the copy", () => {
        const copyOutcome = vi.fn(() => true);
        const { result } = setup({ copy: copyOutcome });

        act(() => result.current.actions.onCopy());

        expect(copyOutcome).toHaveBeenCalled();
        expect(copy).not.toHaveBeenCalled();
    });

    it("still shows the confirmation after a handed-off copy", () => {
        // The host does not re-present the page for a copy, precisely so the
        // toast and confirmation survive.
        const { result } = setup({ copy: () => true });

        act(() => result.current.actions.onCopy());

        expect(result.current.view).toBe("confirmation");
    });

    it("writes the clipboard when there is no host", () => {
        const { result } = setup();

        act(() => result.current.actions.onCopy());

        expect(copy).toHaveBeenCalledWith(
            expect.stringContaining("acme.example")
        );
    });
});

describe("confirmation lifecycle", () => {
    it("opens on the share screen by default", () => {
        expect(setup().result.current.view).toBe("share");
    });

    it("opens on the confirmation screen when the host says so", () => {
        const { result } = setup({}, { confirmed: true });
        expect(result.current.view).toBe("confirmation");
    });

    it("honours a `confirmed` that arrives after mount", () => {
        // A warmed page is activated by fragment, and a `useState` initialiser
        // does not run twice — so the flag has to be watched, not just read.
        const { result, rerender } = renderHook(
            ({ confirmed }: { confirmed: boolean }) =>
                useSharingPageController({
                    merchantId,
                    clientId,
                    link: "https://acme.example/kettle",
                    merchant: { name: "Acme" },
                    source: "sharing_page_wallet",
                    installUrl: null,
                    chrome: { mode: "full" },
                    confirmed,
                    t: (key) => key,
                    outcomes: { dismiss: vi.fn(), install: vi.fn() },
                }),
            { wrapper, initialProps: { confirmed: false } }
        );

        expect(result.current.view).toBe("share");
        rerender({ confirmed: true });
        expect(result.current.view).toBe("confirmation");
    });

    it("returns to the share screen on share-again", () => {
        const shareAgain = vi.fn();
        const { result } = setup({ shareAgain }, { confirmed: true });

        act(() => result.current.actions.onShareAgain());

        expect(result.current.view).toBe("share");
        expect(shareAgain).toHaveBeenCalled();
    });

    it("reports the completed action to the host", () => {
        const onConfirmed = vi.fn();
        const { result } = setup({ onConfirmed, copy: () => false });

        act(() => result.current.actions.onCopy());

        expect(onConfirmed).toHaveBeenCalledWith("copied");
    });

    it("records the sharing interaction on a copy, not only on a share", () => {
        const recordSharing = vi.fn();
        const { result } = setup({ recordSharing });

        act(() => result.current.actions.onCopy());

        expect(recordSharing).toHaveBeenCalled();
    });

    it("falls back to the plain dismiss when there is no confirmation dismiss", () => {
        const { result, dismiss } = setup();

        act(() => result.current.actions.onConfirmationDismiss());

        expect(dismiss).toHaveBeenCalled();
    });
});

describe("props it derives", () => {
    it("hides the product picker when there are no products", () => {
        expect(setup().result.current.products).toBeUndefined();
    });

    it("exposes the picker and tracks the selection", () => {
        const { result } = setup(
            {},
            {
                products: [
                    { title: "Kettle", link: "https://acme.example/k" },
                    { title: "Mug", link: "https://acme.example/m" },
                ],
            }
        );

        expect(result.current.products?.selectedIndex).toBe(0);
        act(() => result.current.products?.onSelect(1));
        expect(result.current.products?.selectedIndex).toBe(1);
        // The selected product's own link wins over the caller's default.
        expect(result.current.sharingLink).toContain("acme.example/m");
    });

    it("lets a host hand off a share the platform cannot do itself", () => {
        // `useShareLink` reports `canShare: false` in an Android WebView; the
        // hand-off is the only reason the button should still be there.
        expect(setup().result.current.share.canShare).toBe(false);
        expect(
            setup({}, { canHandOffShare: true }).result.current.share.canShare
        ).toBe(true);
    });
});
