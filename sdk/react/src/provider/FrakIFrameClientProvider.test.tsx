import { onTestFinished, vi } from "vitest";

vi.mock("@frak-labs/core-sdk", async () => {
    const actual = await vi.importActual<typeof import("@frak-labs/core-sdk")>(
        "@frak-labs/core-sdk"
    );
    return {
        ...actual,
        // Async since the client now resolves the anonymous id before wiring
        // analytics; default to a resolved client so tests that don't care
        // about the client itself still mount the iframe.
        createIFrameFrakClient: vi.fn(
            async () =>
                ({ destroy: vi.fn(async () => {}) }) as unknown as FrakClient
        ),
        // Deterministic: the real one needs WebCrypto and would make every
        // assertion here depend on key generation.
        getClientIdAsync: vi.fn(async () => "test-derived-client-id"),
    };
});

import type { FrakClient, FrakWalletSdkConfig } from "@frak-labs/core-sdk";
import { createIFrameFrakClient, getClientIdAsync } from "@frak-labs/core-sdk";
import {
    keepPreviousData,
    QueryClient,
    QueryClientProvider,
} from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import {
    Activity,
    createElement,
    type ReactNode,
    StrictMode,
    useContext,
} from "react";
import { describe, expect, test } from "../../tests/vitest-fixtures";
import { FrakConfigProvider } from "./FrakConfigProvider";
import {
    FrakIFrameClientContext,
    FrakIFrameClientProvider,
} from "./FrakIFrameClientProvider";

describe("FrakIFrameClientProvider", () => {
    test("should render iframe with correct src", async ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    children
                ),
            });

        render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        // The iframe mounts only once the anonymous id has been derived, so
        // that its src can carry `clientId` on the very first load.
        const iframe = await waitFor(() => {
            const el = document.querySelector("iframe");
            expect(el).not.toBeNull();
            return el;
        });
        expect(iframe?.src).toContain("https://wallet-test.frak.id/listener");
    });

    test("should seed the listener URL with the derived clientId", async ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    children
                ),
            });

        render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        await waitFor(() => {
            const iframe = document.querySelector("iframe");
            expect(iframe?.src).toContain("clientId=");
        });
    });

    test("should apply custom styles to iframe", async ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    children
                ),
            });

        const customStyle = {
            width: "500px",
            height: "600px",
        };

        render(
            createElement(FrakIFrameClientProvider, { style: customStyle }),
            {
                wrapper: Wrapper,
            }
        );

        await waitFor(() => {
            const iframe = document.querySelector("iframe");
            expect(iframe?.style.width).toBe("500px");
            expect(iframe?.style.height).toBe("600px");
        });
    });

    test("should create FrakClient when iframe ref is set", async ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    children
                ),
            });

        const mockClient = {
            config: mockFrakConfig,
            destroy: vi.fn(async () => {}),
        } as unknown as FrakClient;
        vi.mocked(createIFrameFrakClient).mockResolvedValue(mockClient);

        render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        await waitFor(() => {
            expect(createIFrameFrakClient).toHaveBeenCalled();
        });
    });

    test("should not recreate client if already exists", async ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    children
                ),
            });

        const mockClient = {
            config: mockFrakConfig,
            destroy: vi.fn(async () => {}),
        } as unknown as FrakClient;
        vi.mocked(createIFrameFrakClient).mockResolvedValue(mockClient);

        const { rerender } = render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        await waitFor(() => {
            expect(createIFrameFrakClient).toHaveBeenCalledTimes(1);
        });

        // Rerender the component
        rerender(createElement(FrakIFrameClientProvider));

        // Should still only be called once
        expect(createIFrameFrakClient).toHaveBeenCalledTimes(1);
    });

    test("should render without children", ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    children
                ),
            });

        const { container } = render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        const iframe = container.querySelector("iframe");
        expect(iframe).toBeDefined();
    });

    test("should use baseIframeProps for iframe attributes", async ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    children
                ),
            });

        render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        await waitFor(() => {
            const iframe = document.querySelector("iframe");
            expect(iframe).not.toBeNull();
            // baseIframeProps should set these attributes
            expect(iframe?.getAttribute("sandbox")).toBeDefined();
        });
    });

    test("should handle iframe ref callback correctly", ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    children
                ),
            });

        const mockClient = {
            config: mockFrakConfig,
            destroy: vi.fn(async () => {}),
        } as unknown as FrakClient;
        let callCount = 0;

        vi.mocked(createIFrameFrakClient).mockImplementation(async () => {
            callCount++;
            return mockClient;
        });

        render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        // Client creation should be called at most once
        expect(callCount).toBeLessThanOrEqual(1);
    });

    test("should pass config to createIFrameFrakClient", async ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    children
                ),
            });

        const mockClient = {
            config: mockFrakConfig,
            destroy: vi.fn(async () => {}),
        } as unknown as FrakClient;
        vi.mocked(createIFrameFrakClient).mockResolvedValue(mockClient);

        render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        await waitFor(() => {
            expect(createIFrameFrakClient).toHaveBeenCalledWith(
                expect.objectContaining({
                    config: expect.objectContaining({
                        domain: "example.com",
                        env: mockFrakConfig.env,
                    }),
                })
            );
        });
    });

    test("keeps the live client out of the query cache, but still caches the url", async ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    children
                ),
            });

        // Shaped like a real client, so serialising it would drop `request` —
        // the cause of `client.request is not a function` after a rehydrate.
        vi.mocked(createIFrameFrakClient).mockResolvedValue({
            config: mockFrakConfig,
            request: () => Promise.resolve(),
            waitForConnection: new Promise(() => {}),
            waitForSetup: new Promise(() => {}),
            destroy: vi.fn(async () => {}),
        } as unknown as FrakClient);

        render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        await waitFor(() => {
            expect(createIFrameFrakClient).toHaveBeenCalled();
        });

        // Mirrors the `shouldDehydrateQuery` predicate every app configures.
        const queries = queryWrapper.client.getQueryCache().getAll();
        expect(queries.map((q) => q.queryKey[1])).toEqual(["listener-url"]);
        expect(queries[0].meta?.storable ?? true).toBe(true);
    });

    test("creates a fresh client after a remount under the same QueryClient", async ({
        mockFrakConfig,
    }) => {
        // Default gcTime: the fixture's gcTime 0 would hide a reused client.
        const queryClient = new QueryClient();
        let seen: FrakClient | undefined;
        const Spy = () => {
            seen = useContext(FrakIFrameClientContext);
            return null;
        };
        const tree = createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                createElement(
                    FrakIFrameClientProvider,
                    null,
                    createElement(Spy)
                )
            )
        );
        vi.mocked(createIFrameFrakClient).mockImplementation(
            async ({ iframe }) =>
                ({
                    iframe,
                    destroy: vi.fn(async () => {}),
                }) as unknown as FrakClient
        );

        const first = render(tree);
        await waitFor(() => expect(seen).toBeDefined());
        const firstClient = seen;
        first.unmount();
        await waitFor(() =>
            expect(firstClient?.destroy).toHaveBeenCalledWith({
                detachOnly: true,
            })
        );

        seen = undefined;
        render(tree);
        await waitFor(() => expect(seen).toBeDefined());
        expect(createIFrameFrakClient).toHaveBeenCalledTimes(2);
        expect((seen as unknown as { iframe: HTMLIFrameElement }).iframe).toBe(
            document.querySelector("iframe")
        );
        queryClient.clear();
    });

    test("keeps the client and the iframe while hidden by <Activity>", async ({
        mockFrakConfig,
    }) => {
        // Default gcTime: with the fixture's 0, hiding drops the url query and
        // showing again renders a new iframe.
        const queryClient = new QueryClient();
        const created: FrakClient[] = [];
        vi.mocked(createIFrameFrakClient).mockImplementation(async () => {
            const client = {
                destroy: vi.fn(async () => {}),
            } as unknown as FrakClient;
            created.push(client);
            return client;
        });
        let seen: FrakClient | undefined;
        const Spy = () => {
            seen = useContext(FrakIFrameClientContext);
            return null;
        };
        const tree = (mode: "visible" | "hidden") =>
            createElement(
                StrictMode,
                null,
                createElement(
                    QueryClientProvider,
                    { client: queryClient },
                    createElement(
                        FrakConfigProvider,
                        { config: mockFrakConfig },
                        createElement(
                            Activity,
                            { mode },
                            createElement(
                                FrakIFrameClientProvider,
                                null,
                                createElement(Spy)
                            )
                        )
                    )
                )
            );

        const { rerender } = render(tree("visible"));
        await waitFor(() => expect(seen).toBeDefined());
        expect(created).toHaveLength(1);
        const iframe = document.querySelector("iframe");

        rerender(tree("hidden"));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(iframe?.isConnected).toBe(true);
        expect(created[0].destroy).not.toHaveBeenCalled();

        rerender(tree("visible"));
        await waitFor(() => expect(seen).toBe(created[0]));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(created).toHaveLength(1);
        expect(created[0].destroy).not.toHaveBeenCalled();
    });

    test("logs a failed client creation and exposes no client", async ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const failure = new Error("no content window");
        vi.mocked(createIFrameFrakClient).mockRejectedValue(failure);
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        onTestFinished(() => error.mockRestore());
        let seen: FrakClient | undefined;
        const Spy = () => {
            seen = useContext(FrakIFrameClientContext);
            return null;
        };

        render(
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    createElement(
                        FrakIFrameClientProvider,
                        null,
                        createElement(Spy)
                    )
                ),
            })
        );

        await waitFor(() =>
            expect(error).toHaveBeenCalledWith(
                "[Frak] Failed to create the client",
                failure
            )
        );
        expect(seen).toBeUndefined();
    });

    test("drops the old client as soon as the listener url changes", async ({
        mockFrakConfig,
    }) => {
        const created: FrakClient[] = [];
        let releaseSecond: () => void = () => {};
        vi.mocked(createIFrameFrakClient).mockImplementation(({ iframe }) => {
            const client = {
                iframe,
                destroy: vi.fn(async () => {}),
            } as unknown as FrakClient;
            created.push(client);
            if (created.length === 1) return Promise.resolve(client);
            return new Promise((resolve) => {
                releaseSecond = () => resolve(client);
            });
        });
        // A merchant default that renders the previous url while the next one loads.
        const queryClient = new QueryClient({
            defaultOptions: { queries: { placeholderData: keepPreviousData } },
        });
        const { tree, spy } = envTree(mockFrakConfig, {
            wrapper: ({ children }) =>
                createElement(
                    QueryClientProvider,
                    { client: queryClient },
                    children
                ),
        });

        const { rerender } = render(tree("client-a"));
        await waitFor(() => expect(spy.seen).toBeDefined());
        expect(spy.seen).toBe(created[0]);
        rerender(tree("client-b"));
        await waitFor(() => expect(created).toHaveLength(2));
        expect(spy.seen).toBeUndefined();
        await waitFor(() =>
            expect(created[0].destroy).toHaveBeenCalledWith({
                detachOnly: true,
            })
        );

        releaseSecond();
        await waitFor(() => expect(spy.seen).toBe(created[1]));
        expect(
            (created[1] as unknown as { iframe: HTMLIFrameElement }).iframe
        ).toBe(document.querySelector("iframe"));
        queryClient.clear();
    });

    test("ignores an old client that resolves after the listener url changed", async ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const created: FrakClient[] = [];
        let releaseFirst: () => void = () => {};
        vi.mocked(createIFrameFrakClient).mockImplementation(() => {
            const client = {
                destroy: vi.fn(async () => {}),
            } as unknown as FrakClient;
            created.push(client);
            if (created.length > 1) return Promise.resolve(client);
            return new Promise((resolve) => {
                releaseFirst = () => resolve(client);
            });
        });
        const { tree, spy } = envTree(mockFrakConfig, queryWrapper);

        const { rerender } = render(tree("client-a"));
        await waitFor(() => expect(created).toHaveLength(1));
        rerender(tree("client-b"));
        await waitFor(() => expect(created).toHaveLength(2));
        await waitFor(() => expect(spy.seen).toBe(created[1]));

        releaseFirst();
        await waitFor(() =>
            expect(created[0].destroy).toHaveBeenCalledWith({
                detachOnly: true,
            })
        );
        expect(spy.seen).toBe(created[1]);
    });
});

function envTree(
    mockFrakConfig: FrakWalletSdkConfig,
    queryWrapper: { wrapper: (props: { children: ReactNode }) => ReactNode }
) {
    const spy: { seen: FrakClient | undefined } = { seen: undefined };
    const Spy = () => {
        spy.seen = useContext(FrakIFrameClientContext);
        return null;
    };
    vi.mocked(getClientIdAsync).mockImplementation(async () => clientId);
    let clientId = "client-a";
    const tree = (id: string) => {
        clientId = id;
        return queryWrapper.wrapper({
            children: createElement(
                FrakConfigProvider,
                {
                    config: {
                        ...mockFrakConfig,
                        env: {
                            wallet: `https://wallet-${id}.frak.id`,
                            backend: "https://backend-test.frak.id",
                        },
                    },
                },
                createElement(
                    FrakIFrameClientProvider,
                    null,
                    createElement(Spy)
                )
            ),
        });
    };
    return { tree, spy };
}
