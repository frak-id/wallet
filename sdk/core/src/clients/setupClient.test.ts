import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock dependencies
vi.mock("../utils", () => ({
    createIframe: vi.fn(),
    getSupportedCurrency: vi.fn((currency) => currency || "eur"),
}));

vi.mock("./createIFrameFrakClient", () => ({
    createIFrameFrakClient: vi.fn(),
}));

describe("setupClient", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                ok: true,
                json: async () => ({ merchantId: "merchant-default" }),
            }))
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe("client setup", () => {
        test("should create iframe with prepared config", async () => {
            const { setupClient } = await import("./setupClient");
            const { createIframe } = await import("../utils");
            const { createIFrameFrakClient } = await import(
                "./createIFrameFrakClient"
            );

            const mockIframe = document.createElement("iframe");
            const mockClient = {
                waitForSetup: Promise.resolve(),
                waitForConnection: Promise.resolve(true),
            };

            vi.mocked(createIframe).mockResolvedValue(mockIframe);
            vi.mocked(createIFrameFrakClient).mockReturnValue(
                mockClient as any
            );

            const config = {
                metadata: {
                    name: "Test App",
                },
            };

            await setupClient({ config });

            expect(createIframe).toHaveBeenCalledWith({
                config: expect.objectContaining({
                    metadata: expect.objectContaining({
                        name: "Test App",
                        currency: "eur",
                    }),
                }),
            });
        });

        test("should preserve custom currency in config", async () => {
            const { setupClient } = await import("./setupClient");
            const { createIframe } = await import("../utils");
            const { createIFrameFrakClient } = await import(
                "./createIFrameFrakClient"
            );
            const { getSupportedCurrency } = await import("../utils");

            const mockIframe = document.createElement("iframe");
            const mockClient = {
                waitForSetup: Promise.resolve(),
                waitForConnection: Promise.resolve(true),
            };

            vi.mocked(getSupportedCurrency).mockReturnValue("usd");
            vi.mocked(createIframe).mockResolvedValue(mockIframe);
            vi.mocked(createIFrameFrakClient).mockReturnValue(
                mockClient as any
            );

            const config = {
                metadata: {
                    name: "Test App",
                    currency: "usd" as const,
                },
            };

            await setupClient({ config });

            expect(getSupportedCurrency).toHaveBeenCalledWith("usd");
            expect(createIframe).toHaveBeenCalledWith({
                config: expect.objectContaining({
                    metadata: expect.objectContaining({
                        currency: "usd",
                    }),
                }),
            });
        });

        test("should return undefined when iframe creation fails", async () => {
            const { setupClient } = await import("./setupClient");
            const { createIframe } = await import("../utils");

            vi.mocked(createIframe).mockResolvedValue(undefined);

            const config = {
                metadata: {
                    name: "Test App",
                },
            };

            const result = await setupClient({ config });

            expect(result).toBeUndefined();
        });

        test("should create FrakClient with iframe", async () => {
            const { setupClient } = await import("./setupClient");
            const { createIframe } = await import("../utils");
            const { createIFrameFrakClient } = await import(
                "./createIFrameFrakClient"
            );

            const mockIframe = document.createElement("iframe");
            const mockClient = {
                waitForSetup: Promise.resolve(),
                waitForConnection: Promise.resolve(true),
            };

            vi.mocked(createIframe).mockResolvedValue(mockIframe);
            vi.mocked(createIFrameFrakClient).mockReturnValue(
                mockClient as any
            );

            const config = {
                metadata: {
                    name: "Test App",
                },
            };

            await setupClient({ config });

            expect(createIFrameFrakClient).toHaveBeenCalledWith({
                config: expect.objectContaining({
                    metadata: expect.objectContaining({
                        name: "Test App",
                    }),
                }),
                iframe: mockIframe,
            });
        });

        test("should wait for client setup", async () => {
            const { setupClient } = await import("./setupClient");
            const { createIframe } = await import("../utils");
            const { createIFrameFrakClient } = await import(
                "./createIFrameFrakClient"
            );

            const mockIframe = document.createElement("iframe");
            const setupPromise = Promise.resolve();
            const mockClient = {
                waitForSetup: setupPromise,
                waitForConnection: Promise.resolve(true),
            };

            vi.mocked(createIframe).mockResolvedValue(mockIframe);
            vi.mocked(createIFrameFrakClient).mockReturnValue(
                mockClient as any
            );

            const config = {
                metadata: {
                    name: "Test App",
                },
            };

            await setupClient({ config });

            // Verify setup was awaited
            await expect(setupPromise).resolves.toBeUndefined();
        });

        test("should wait for connection", async () => {
            const { setupClient } = await import("./setupClient");
            const { createIframe } = await import("../utils");
            const { createIFrameFrakClient } = await import(
                "./createIFrameFrakClient"
            );

            const mockIframe = document.createElement("iframe");
            const connectionPromise = Promise.resolve(true);
            const mockClient = {
                waitForSetup: Promise.resolve(),
                waitForConnection: connectionPromise,
            };

            vi.mocked(createIframe).mockResolvedValue(mockIframe);
            vi.mocked(createIFrameFrakClient).mockReturnValue(
                mockClient as any
            );

            const config = {
                metadata: {
                    name: "Test App",
                },
            };

            await setupClient({ config });

            // Verify connection was awaited
            await expect(connectionPromise).resolves.toBe(true);
        });

        test("returns undefined and detaches the client when the handshake times out", async () => {
            const { setupClient } = await import("./setupClient");
            const { createIframe } = await import("../utils");
            const { createIFrameFrakClient } = await import(
                "./createIFrameFrakClient"
            );

            const mockIframe = document.createElement("iframe");
            const mockClient = {
                waitForSetup: new Promise<void>(() => {}),
                waitForConnection: Promise.resolve(false),
                destroy: vi.fn(async () => {}),
            };

            vi.mocked(createIframe).mockResolvedValue(mockIframe);
            vi.mocked(createIFrameFrakClient).mockReturnValue(
                mockClient as any
            );

            const config = {
                metadata: {
                    name: "Test App",
                },
            };

            const result = await setupClient({ config });

            expect(result).toBeUndefined();
            expect(mockClient.destroy).toHaveBeenCalledExactlyOnceWith({
                detachOnly: true,
            });
        });

        test("should return client when setup successful", async () => {
            const { setupClient } = await import("./setupClient");
            const { createIframe } = await import("../utils");
            const { createIFrameFrakClient } = await import(
                "./createIFrameFrakClient"
            );

            const mockIframe = document.createElement("iframe");
            const mockClient = {
                waitForSetup: Promise.resolve(),
                waitForConnection: Promise.resolve(true),
                request: vi.fn(),
            };

            vi.mocked(createIframe).mockResolvedValue(mockIframe);
            vi.mocked(createIFrameFrakClient).mockReturnValue(
                mockClient as any
            );

            const config = {
                metadata: {
                    name: "Test App",
                },
            };

            const result = await setupClient({ config });

            expect(result).toBe(mockClient);
        });
    });

    describe("cached merchant config", () => {
        const cachedConfig = {
            isResolved: true,
            merchantId: "merchant-cached",
            domain: "shop.example.com",
            components: { ambassador: { heroHeading: { en: "Cached" } } },
        };
        const config = {
            domain: "shop.example.com",
            metadata: { name: "Test App", lang: "en" as const },
        };

        beforeEach(async () => {
            const { sdkConfigStore } = await import("../config/sdkConfigStore");
            sdkConfigStore.clearCache();
            localStorage.clear();
            window.__frakSdkConfig = undefined;
        });

        test("publishes an expired per-store cache before the iframe is created", async () => {
            const { setupClient } = await import("./setupClient");
            const { createIframe } = await import("../utils");
            const { sdkConfigStore } = await import("../config/sdkConfigStore");
            localStorage.setItem(
                "frak-config-cache:shop.example.com:en",
                JSON.stringify({ config: cachedConfig, timestamp: 0 })
            );
            const onConfig = vi.fn();
            window.addEventListener("frak:config", onConfig);

            let configAtIframeCreation: unknown;
            vi.mocked(createIframe).mockImplementation(async () => {
                configAtIframeCreation = sdkConfigStore.getConfig();
                return undefined;
            });

            await setupClient({ config });
            window.removeEventListener("frak:config", onConfig);

            expect(configAtIframeCreation).toEqual(cachedConfig);
            expect(onConfig).toHaveBeenCalledWith(
                expect.objectContaining({ detail: cachedConfig })
            );
        });

        test("leaves the config unresolved when the store has no cache", async () => {
            const { setupClient } = await import("./setupClient");
            const { createIframe } = await import("../utils");
            const { sdkConfigStore } = await import("../config/sdkConfigStore");
            vi.mocked(createIframe).mockResolvedValue(undefined);

            await setupClient({ config });

            expect(sdkConfigStore.getConfig().isResolved).toBe(false);
        });
    });

    describe("early merchant config fetch", () => {
        const merchantResponse = {
            merchantId: "merchant-fetched",
            domain: "shop.example.com",
            allowedDomains: [],
        };
        const config = {
            domain: "shop.example.com",
            env: {
                wallet: "https://wallet.fra436.test",
                backend: "https://backend.fra436.test",
            },
            metadata: { name: "Test App", lang: "en" as const },
        };
        const mockClient = {
            waitForSetup: Promise.resolve(),
            waitForConnection: Promise.resolve(true),
        };
        let fetchMock: ReturnType<typeof vi.fn>;

        beforeEach(async () => {
            const { sdkConfigStore } = await import("../config/sdkConfigStore");
            sdkConfigStore.clearCache();
            localStorage.clear();
            window.__frakSdkConfig = undefined;
            fetchMock = vi.fn(async () => ({
                ok: true,
                json: async () => merchantResponse,
            }));
            vi.stubGlobal("fetch", fetchMock);
        });

        test("starts the fetch against the configured backend before the iframe loads, and resolve reuses its answer", async () => {
            const { setupClient } = await import("./setupClient");
            const { createIframe } = await import("../utils");
            const { createIFrameFrakClient } = await import(
                "./createIFrameFrakClient"
            );
            let loadIframe: (iframe: HTMLIFrameElement) => void = () => {};
            vi.mocked(createIframe).mockReturnValue(
                new Promise((resolve) => {
                    loadIframe = resolve;
                })
            );
            vi.mocked(createIFrameFrakClient).mockReturnValue(
                mockClient as any
            );

            const setup = setupClient({ config });

            await vi.waitFor(() => expect(createIframe).toHaveBeenCalled());
            expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
                "https://backend.fra436.test/user/merchant/resolve?domain=shop.example.com&lang=en"
            );
            expect(createIFrameFrakClient).not.toHaveBeenCalled();

            const iframe = document.createElement("iframe");
            loadIframe(iframe);
            await setup;

            const { sdkConfigStore } = await import("../config/sdkConfigStore");
            await expect(
                sdkConfigStore.resolve("shop.example.com", "en")
            ).resolves.toEqual(merchantResponse);
            expect(fetchMock).toHaveBeenCalledOnce();
        });

        test("fetches early with the page's <html lang> when metadata.lang is unset", async () => {
            const { setupClient } = await import("./setupClient");
            const { createIframe } = await import("../utils");
            const { createIFrameFrakClient } = await import(
                "./createIFrameFrakClient"
            );
            const previousLang = document.documentElement.lang;
            document.documentElement.lang = "fr";
            vi.mocked(createIframe).mockResolvedValue(
                document.createElement("iframe")
            );
            vi.mocked(createIFrameFrakClient).mockReturnValue(
                mockClient as any
            );

            try {
                await setupClient({
                    config: { ...config, metadata: { name: "Test App" } },
                });
            } finally {
                document.documentElement.lang = previousLang;
            }

            expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
                "https://backend.fra436.test/user/merchant/resolve?domain=shop.example.com&lang=fr"
            );
        });

        test("starts no fetch when the cache is fresh", async () => {
            const { setupClient } = await import("./setupClient");
            const { createIframe } = await import("../utils");
            const { createIFrameFrakClient } = await import(
                "./createIFrameFrakClient"
            );
            localStorage.setItem(
                "frak-config-cache:shop.example.com:en",
                JSON.stringify({
                    config: { isResolved: true, merchantId: "merchant-cached" },
                    timestamp: Date.now(),
                })
            );
            vi.mocked(createIframe).mockResolvedValue(
                document.createElement("iframe")
            );
            vi.mocked(createIFrameFrakClient).mockReturnValue(
                mockClient as any
            );

            await setupClient({ config });

            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe("config preparation", () => {
        test("should use default currency when none provided", async () => {
            const { setupClient } = await import("./setupClient");
            const { createIframe } = await import("../utils");
            const { createIFrameFrakClient } = await import(
                "./createIFrameFrakClient"
            );
            const { getSupportedCurrency } = await import("../utils");

            const mockIframe = document.createElement("iframe");
            const mockClient = {
                waitForSetup: Promise.resolve(),
                waitForConnection: Promise.resolve(true),
            };

            vi.mocked(getSupportedCurrency).mockReturnValue("eur");
            vi.mocked(createIframe).mockResolvedValue(mockIframe);
            vi.mocked(createIFrameFrakClient).mockReturnValue(
                mockClient as any
            );

            const config = {
                metadata: {
                    name: "Test App",
                },
            };

            await setupClient({ config });

            expect(getSupportedCurrency).toHaveBeenCalledWith(undefined);
        });

        test("should merge metadata with prepared config", async () => {
            const { setupClient } = await import("./setupClient");
            const { createIframe } = await import("../utils");
            const { createIFrameFrakClient } = await import(
                "./createIFrameFrakClient"
            );

            const mockIframe = document.createElement("iframe");
            const mockClient = {
                waitForSetup: Promise.resolve(),
                waitForConnection: Promise.resolve(true),
            };

            vi.mocked(createIframe).mockResolvedValue(mockIframe);
            vi.mocked(createIFrameFrakClient).mockReturnValue(
                mockClient as any
            );

            const config = {
                metadata: {
                    name: "Test App",
                    css: {
                        primaryColor: "#ff0000",
                    },
                },
            };

            await setupClient({ config });

            expect(createIframe).toHaveBeenCalledWith({
                config: expect.objectContaining({
                    metadata: expect.objectContaining({
                        name: "Test App",
                        css: {
                            primaryColor: "#ff0000",
                        },
                        currency: "eur",
                    }),
                }),
            });
        });
    });
});
