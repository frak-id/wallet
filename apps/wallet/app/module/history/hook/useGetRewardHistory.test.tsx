/** @jsxImportSource react */
import { rewardsKey } from "@frak-labs/wallet-shared";
import { act, render, renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import {
    useGetRewardHistory,
    useTrimRewardHistoryOnLeave,
} from "@/module/history/hook/useGetRewardHistory";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

vi.mock("wagmi", () => ({
    useConnection: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared/common/api/backendClient", () => ({
    authenticatedWalletApi: {
        rewards: {
            history: {
                get: vi.fn(),
            },
        },
    },
}));

describe("useGetRewardHistory", () => {
    beforeEach(({ queryWrapper }) => {
        vi.clearAllMocks();
        queryWrapper.client.clear();
    });

    function createSuccessResponse<T>(data: T) {
        return {
            data,
            error: null,
            response: new Response(),
            status: 200,
            headers: new Headers(),
        };
    }

    const mockItem = {
        id: "asset-1",
        merchant: {
            id: "merchant-1",
            name: "Frak",
            domain: "frak.id",
        },
        token: {
            symbol: "USDC",
            decimals: 6,
        },
        amount: {
            amount: 12.5,
            eurAmount: 11.25,
            usdAmount: 12.5,
            gbpAmount: 9.75,
        },
        status: "pending" as const,
        role: "referee" as const,
        trigger: "purchase" as const,
        txHash: "0xabc123",
        createdAt: new Date("2026-01-20T10:00:00.000Z"),
    };

    test("should return initial loading state", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const { useConnection } = await import("wagmi");
        vi.mocked(useConnection).mockImplementation(
            mockWagmiHooks.useConnection as any
        );

        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared/common/api/backendClient"
        );
        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            createSuccessResponse({ items: [mockItem], totalCount: 1 })
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.isLoading).toBe(true);
        expect(result.current.items).toEqual([]);
    });

    test("should return rewards when data is available", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const { useConnection } = await import("wagmi");
        vi.mocked(useConnection).mockImplementation(
            mockWagmiHooks.useConnection as any
        );

        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared/common/api/backendClient"
        );
        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            createSuccessResponse({ items: [mockItem], totalCount: 1 })
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.items[0]?.createdAt).toBe(
            mockItem.createdAt.getTime()
        );
    });

    test("should not fetch when address is missing", async ({
        queryWrapper,
    }) => {
        const { useConnection } = await import("wagmi");
        vi.mocked(useConnection).mockReturnValue({
            address: undefined,
            isConnected: false,
            isConnecting: false,
            isDisconnected: true,
        } as any);

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared/common/api/backendClient"
        );

        expect(result.current.items).toEqual([]);
        expect(
            authenticatedWalletApi.rewards.history.get
        ).not.toHaveBeenCalled();
    });

    test("should return correct flat reward structure", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const { useConnection } = await import("wagmi");
        vi.mocked(useConnection).mockImplementation(
            mockWagmiHooks.useConnection as any
        );

        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared/common/api/backendClient"
        );
        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            createSuccessResponse({ items: [mockItem], totalCount: 1 })
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.items[0]).toEqual({
            ...mockItem,
            createdAt: mockItem.createdAt.getTime(),
        });
    });

    test("should return total count", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const { useConnection } = await import("wagmi");
        vi.mocked(useConnection).mockImplementation(
            mockWagmiHooks.useConnection as any
        );

        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared/common/api/backendClient"
        );
        vi.mocked(authenticatedWalletApi.rewards.history.get).mockResolvedValue(
            createSuccessResponse({ items: [mockItem], totalCount: 1 })
        );

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.totalCount).toBe(1);
    });

    test("loads older rewards page by page until the total is reached", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const { useConnection } = await import("wagmi");
        vi.mocked(useConnection).mockImplementation(
            mockWagmiHooks.useConnection as any
        );

        const get = await serveHistory(rewards(25));

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.items).toHaveLength(20));
        expect(result.current.hasNextPage).toBe(true);

        await act(() => result.current.fetchNextPage());

        await waitFor(() => expect(result.current.items).toHaveLength(25));
        expect(result.current.items.at(-1)?.id).toBe("asset-25");
        expect(result.current.hasNextPage).toBe(false);
        expect(get).toHaveBeenLastCalledWith({
            query: { offset: 20, limit: 20 },
        });
    });

    test("shows a reward once when a new reward shifts the next page", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const { useConnection } = await import("wagmi");
        vi.mocked(useConnection).mockImplementation(
            mockWagmiHooks.useConnection as any
        );

        const all = rewards(25);
        await serveHistory(all);

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });
        await waitFor(() => expect(result.current.items).toHaveLength(20));

        all.unshift({ ...mockItem, id: "asset-new" });
        await act(() => result.current.fetchNextPage());

        await waitFor(() => expect(result.current.hasNextPage).toBe(false));
        const ids = result.current.items.map((item) => item.id);
        expect(ids).toHaveLength(25);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test("keeps only the first page once the history page is left", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const { useConnection } = await import("wagmi");
        vi.mocked(useConnection).mockImplementation(
            mockWagmiHooks.useConnection as any
        );
        await serveHistory(rewards(25));

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });
        await waitFor(() => expect(result.current.items).toHaveLength(20));
        const historyPage = renderHook(() => useTrimRewardHistoryOnLeave(), {
            wrapper: queryWrapper.wrapper,
        });
        await act(() => result.current.fetchNextPage());
        await waitFor(() => expect(result.current.items).toHaveLength(25));

        historyPage.unmount();

        await waitFor(() => expect(result.current.items).toHaveLength(20));
        expect(result.current.hasNextPage).toBe(true);
    });

    test("keeps the trim when the history page is left mid-load", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const { useConnection } = await import("wagmi");
        vi.mocked(useConnection).mockImplementation(
            mockWagmiHooks.useConnection as any
        );
        const get = await serveHistory(rewards(45));
        const serve = get.getMockImplementation();
        let releaseLastPage = () => {};
        get.mockImplementation((async (options?: {
            query?: { offset?: number };
        }) => {
            if (options?.query?.offset === 40) {
                await new Promise<void>((resolve) => {
                    releaseLastPage = resolve;
                });
            }
            return serve?.(options as never);
        }) as any);

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });
        await waitFor(() => expect(result.current.items).toHaveLength(20));
        const historyPage = renderHook(() => useTrimRewardHistoryOnLeave(), {
            wrapper: queryWrapper.wrapper,
        });
        await act(() => result.current.fetchNextPage());
        await waitFor(() => expect(result.current.items).toHaveLength(40));
        act(() => {
            void result.current.fetchNextPage();
        });
        await waitFor(() =>
            expect(result.current.isFetchingNextPage).toBe(true)
        );

        historyPage.unmount();
        await act(async () => releaseLastPage());

        await waitFor(() => expect(result.current.items).toHaveLength(20));
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(result.current.items).toHaveLength(20);
    });

    test("keeps the trim when the wallet home replaces the history page", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const { useConnection } = await import("wagmi");
        vi.mocked(useConnection).mockImplementation(
            mockWagmiHooks.useConnection as any
        );
        await serveHistory(rewards(45));
        const seen: { items: number; next?: () => Promise<unknown> } = {
            items: 0,
        };
        function HistoryPage() {
            const history = useGetRewardHistory();
            useTrimRewardHistoryOnLeave();
            seen.items = history.items.length;
            seen.next = history.fetchNextPage;
            return null;
        }
        function Home() {
            seen.items = useGetRewardHistory().items.length;
            return null;
        }
        const Wrapper = queryWrapper.wrapper;
        const view = render(
            <Wrapper>
                <HistoryPage />
            </Wrapper>
        );
        await waitFor(() => expect(seen.items).toBe(20));
        await act(async () => {
            await seen.next?.();
        });
        await act(async () => {
            await seen.next?.();
        });
        await waitFor(() => expect(seen.items).toBe(45));

        view.rerender(
            <Wrapper>
                <Home />
            </Wrapper>
        );

        await act(() => new Promise((resolve) => setTimeout(resolve, 150)));
        expect(seen.items).toBe(20);
    });

    test("keeps the first page's fetch time when the history page is left", async ({
        queryWrapper,
        mockWagmiHooks,
    }) => {
        const { useConnection } = await import("wagmi");
        vi.mocked(useConnection).mockImplementation(
            mockWagmiHooks.useConnection as any
        );
        await serveHistory(rewards(25));

        const { result } = renderHook(() => useGetRewardHistory(), {
            wrapper: queryWrapper.wrapper,
        });
        await waitFor(() => expect(result.current.items).toHaveLength(20));
        const historyPage = renderHook(() => useTrimRewardHistoryOnLeave(), {
            wrapper: queryWrapper.wrapper,
        });
        await act(() => result.current.fetchNextPage());
        await waitFor(() => expect(result.current.items).toHaveLength(25));
        const historyQuery = () =>
            queryWrapper.client
                .getQueryCache()
                .find({ queryKey: rewardsKey.histories(), exact: false });
        const fetchedAt = historyQuery()?.state.dataUpdatedAt;
        expect(fetchedAt).toBeGreaterThan(0);
        await new Promise((resolve) => setTimeout(resolve, 20));

        historyPage.unmount();

        await waitFor(() => expect(result.current.items).toHaveLength(20));
        expect(historyQuery()?.state.dataUpdatedAt).toBe(fetchedAt);
    });

    function rewards(count: number) {
        return Array.from({ length: count }, (_, index) => ({
            ...mockItem,
            id: `asset-${index + 1}`,
        }));
    }

    async function serveHistory(all: ReturnType<typeof rewards>) {
        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared/common/api/backendClient"
        );
        const get = vi.mocked(authenticatedWalletApi.rewards.history.get);
        get.mockImplementation((async (options?: {
            query?: { offset?: number; limit?: number };
        }) => {
            const offset = options?.query?.offset ?? 0;
            const limit = options?.query?.limit ?? 20;
            return createSuccessResponse({
                items: all.slice(offset, offset + limit),
                totalCount: all.length,
            });
        }) as any);
        return get;
    }
});
