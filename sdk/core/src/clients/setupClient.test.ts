import { beforeEach, describe, expect, test, vi } from "vitest";

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

        test("should return undefined when connection fails", async () => {
            const { setupClient } = await import("./setupClient");
            const { createIframe } = await import("../utils");
            const { createIFrameFrakClient } = await import(
                "./createIFrameFrakClient"
            );

            const mockIframe = document.createElement("iframe");
            const mockClient = {
                waitForSetup: Promise.resolve(),
                waitForConnection: Promise.resolve(false),
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
