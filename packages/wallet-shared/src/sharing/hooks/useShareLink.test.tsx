import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useShareLink } from "./useShareLink";

const invoke = vi.hoisted(() => vi.fn());
const recordError = vi.hoisted(() => vi.fn());

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    IS_TAURI: true,
}));
vi.mock("../../common/tauri", () => ({
    getInvoke: () => Promise.resolve(invoke),
}));
vi.mock("../../common/analytics", () => ({
    trackEvent: vi.fn(),
    recordError,
}));

const LINK = "https://shop.example/?fCtx=abc";

function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    });
    return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
}

describe("useShareLink on Tauri", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("reports a share sheet the native plugin refused to open", async () => {
        invoke.mockRejectedValue("A share sheet is already open");
        const { result } = renderHook(
            () =>
                useShareLink(
                    LINK,
                    {},
                    { source: "explorer_detail", merchantId: "m-1" }
                ),
            { wrapper }
        );

        act(() => result.current.mutate());

        await waitFor(() =>
            expect(recordError).toHaveBeenCalledWith(
                "A share sheet is already open",
                {
                    source: "sharing",
                    context: {
                        sharing_source: "explorer_detail",
                        merchant_id: "m-1",
                    },
                }
            )
        );
    });

    it("does not report a share sheet the user dismissed", async () => {
        invoke.mockResolvedValue({ shared: false });
        const { result } = renderHook(
            () => useShareLink(LINK, {}, { source: "explorer_detail" }),
            { wrapper }
        );

        act(() => result.current.mutate());

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(recordError).not.toHaveBeenCalled();
    });
});
