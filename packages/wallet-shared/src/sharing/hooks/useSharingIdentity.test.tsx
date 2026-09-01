import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clientIdStore } from "../../stores/clientIdStore";
import { sharingKey } from "../queryKeys";
import { useSharingIdentity } from "./useSharingIdentity";

const orderClientGet = vi.hoisted(() => vi.fn());

vi.mock("../../common/api/backendClient", () => ({
    authenticatedBackendApi: {
        user: { identity: { "order-client": { get: orderClientGet } } },
    },
}));

const MERCHANT_ID = "550e8400-e29b-41d4-a716-446655440000";
const RESOLVED_ID = "550e8400-e29b-41d4-a716-446655440001";
const MINTED_ID = "frakmint_550e8400-e29b-41d4-a716-446655440002";
const TOKEN = "tok-1";

/**
 * Held by the test rather than the wrapper, so an assertion can wait for the
 * query to SETTLE. Without that, `toBeUndefined()` also passes on the first
 * render — before the response arrives — and the test proves nothing.
 */
let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}

const renderIdentity = (embedded = false) =>
    renderHook(
        () =>
            useSharingIdentity({
                merchantId: MERCHANT_ID,
                checkoutToken: TOKEN,
                embedded,
            }),
        { wrapper }
    );

const settled = () =>
    waitFor(() =>
        expect(
            queryClient.getQueryState(
                sharingKey.orderClient(MERCHANT_ID, TOKEN)
            )?.status
        ).toBe("success")
    );

describe("useSharingIdentity", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clientIdStore.setState({ clientId: null });
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false, gcTime: 0 } },
        });
    });

    it("resolves the order's anonymous id when the store holds none", async () => {
        orderClientGet.mockResolvedValue({
            data: { clientId: RESOLVED_ID },
            error: null,
        });

        const { result } = renderIdentity();

        await waitFor(() => expect(result.current).toBe(RESOLVED_ID));
    });

    it("discards a server-minted id instead of publishing one that cannot be encoded", async () => {
        orderClientGet.mockResolvedValue({
            data: { clientId: MINTED_ID },
            error: null,
        });

        const { result } = renderIdentity();

        await settled();
        expect(result.current).toBeUndefined();
    });

    it("never looks up the order when a host owns the identity", () => {
        clientIdStore.setState({ clientId: RESOLVED_ID });

        const { result } = renderIdentity(true);

        // Under `embed` the store must not stand in for a host-supplied id.
        expect(result.current).toBeUndefined();
        expect(orderClientGet).not.toHaveBeenCalled();
    });
});
