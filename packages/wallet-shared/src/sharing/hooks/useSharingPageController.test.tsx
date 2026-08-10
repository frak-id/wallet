import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "../../common/analytics";
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

// real UUIDs: `FrakContextManager` validates these, and a short stand-in makes
// `buildSharingLink` return null
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

    it("reports the tap when the host takes the share", () => {
        // `useShareLink` never runs on this path, so without this the whole
        // handed-off share funnel is invisible in OpenPanel.
        const { result } = setup({ share: () => true });

        act(() => result.current.actions.onShare());

        expect(trackEvent).toHaveBeenCalledWith("sharing_link_started", {
            source: "sharing_page_wallet",
            merchant_id: merchantId,
            handed_off: true,
        });
    });

    it("reports a handed-off share even with no link of its own", () => {
        const { result } = setup(
            { share: () => true },
            { clientId: undefined }
        );

        act(() => result.current.actions.onShare());

        expect(result.current.sharingLink).toBeNull();
        expect(trackEvent).toHaveBeenCalledWith(
            "sharing_link_started",
            expect.objectContaining({ handed_off: true })
        );
    });

    it("records the interaction when the host takes the share", () => {
        const recordSharing = vi.fn();
        const { result } = setup({ share: () => true, recordSharing });

        act(() => result.current.actions.onShare());

        expect(recordSharing).toHaveBeenCalled();
    });

    it("leaves the local share to `useShareLink` to report", () => {
        // The local path emits `sharing_link_started` from inside the mutation,
        // which is mocked here — the controller must not double-fire it.
        const { result } = setup({ share: () => false });

        act(() => result.current.actions.onShare());

        expect(trackEvent).not.toHaveBeenCalledWith(
            "sharing_link_started",
            expect.anything()
        );
    });

    it("does not write the clipboard when the host takes the copy", () => {
        const copyOutcome = vi.fn(() => true);
        const { result } = setup({ copy: copyOutcome });

        act(() => result.current.actions.onCopy());

        expect(copyOutcome).toHaveBeenCalled();
        expect(copy).not.toHaveBeenCalled();
    });

    it("still shows the confirmation after a handed-off copy", () => {
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
        expect(result.current.sharingLink).toContain("acme.example/m");
    });

    it("lets a host hand off a share the platform cannot do itself", () => {
        // `useShareLink` is mocked to `canShare: false`, as in an Android WebView
        expect(setup().result.current.share.canShare).toBe(false);
        expect(
            setup({}, { canHandOff: true }).result.current.share.canShare
        ).toBe(true);
    });

    it("can act while it has a link of its own", () => {
        expect(setup().result.current.share.canAct).toBe(true);
    });

    it("cannot act with neither a link nor a host", () => {
        // No clientId and no wallet: `buildSharingLink` returns null.
        const { result } = setup({}, { clientId: undefined });

        expect(result.current.sharingLink).toBeNull();
        expect(result.current.share.canAct).toBe(false);
    });

    it("can act with no link of its own once a host is listening", () => {
        // The host services share/copy with the link IT built; this page having
        // none must not disable CTAs the host can fulfil.
        const { result } = setup({}, { clientId: undefined, canHandOff: true });

        expect(result.current.sharingLink).toBeNull();
        expect(result.current.share.canAct).toBe(true);
    });
});

describe("the copied event", () => {
    it("reports the link when this page wrote the clipboard", () => {
        const { result } = setup({ copy: () => false });

        act(() => result.current.actions.onCopy());

        expect(trackEvent).toHaveBeenCalledWith(
            "sharing_link_copied",
            expect.objectContaining({
                link: expect.stringContaining("acme.example"),
                handed_off: false,
            })
        );
    });

    it("reports no link when the host wrote the clipboard", () => {
        // The host copies its own link, which this page never sees — reporting
        // ours would attribute the copy to a URL the user never got.
        const { result } = setup({ copy: () => true });

        act(() => result.current.actions.onCopy());

        expect(trackEvent).toHaveBeenCalledWith(
            "sharing_link_copied",
            expect.objectContaining({ link: undefined, handed_off: true })
        );
    });

    it("completes a handed-off copy even with no link of its own", () => {
        const recordSharing = vi.fn();
        const onConfirmed = vi.fn();
        const { result } = setup(
            { copy: () => true, recordSharing, onConfirmed },
            { clientId: undefined }
        );

        act(() => result.current.actions.onCopy());

        expect(result.current.sharingLink).toBeNull();
        expect(copy).not.toHaveBeenCalled();
        expect(recordSharing).toHaveBeenCalled();
        expect(onConfirmed).toHaveBeenCalledWith("copied");
        expect(result.current.view).toBe("confirmation");
    });

    it("does nothing with neither a link nor a host", () => {
        const recordSharing = vi.fn();
        const { result } = setup({ recordSharing }, { clientId: undefined });

        act(() => result.current.actions.onCopy());

        expect(copy).not.toHaveBeenCalled();
        expect(trackEvent).not.toHaveBeenCalledWith(
            "sharing_link_copied",
            expect.anything()
        );
        expect(recordSharing).not.toHaveBeenCalled();
        expect(result.current.view).toBe("share");
    });
});
