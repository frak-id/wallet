/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as clientsModule from "../clients";
import type { FrakClient, FrakWalletSdkConfig } from "../types";
import * as utilsModule from "../utils";
import { setupClient } from "./setupClient";

// We need to mock at module level for proper mocking
vi.mock("../utils");
vi.mock("../clients");

describe("setupClient", () => {
    // Create a mock iframe
    const mockIframe = document.createElement("iframe");

    // Mock client with waitForSetup and waitForConnection properties
    const mockClient = {
        waitForSetup: Promise.resolve(),
        waitForConnection: Promise.resolve(true),
    } as unknown as FrakClient;

    // Sample config
    const mockConfig: FrakWalletSdkConfig = {
        metadata: {
            name: "Test App",
        },
    };

    beforeEach(() => {
        vi.resetAllMocks();

        // Properly mock console.error
        vi.spyOn(console, "error").mockImplementation(() => {});

        // Setup default success mocks
        vi.mocked(utilsModule.createIframe).mockResolvedValue(mockIframe);
        vi.mocked(clientsModule.createIFrameFrakClient).mockReturnValue(
            mockClient
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should successfully setup the client", async () => {
        // Execute
        const result = await setupClient({ config: mockConfig });

        // Verify
        expect(utilsModule.createIframe).toHaveBeenCalledWith({
            config: mockConfig,
        });
        expect(clientsModule.createIFrameFrakClient).toHaveBeenCalledWith({
            config: mockConfig,
            iframe: mockIframe,
        });
        expect(result).toBe(mockClient);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("should handle iframe creation failure", async () => {
        // Mock iframe creation failure
        vi.mocked(utilsModule.createIframe).mockResolvedValue(undefined);

        // Execute
        const result = await setupClient({ config: mockConfig });

        // Verify
        expect(result).toBeUndefined();
        expect(clientsModule.createIFrameFrakClient).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith("Failed to create iframe");
    });

    it("should handle connection failure", async () => {
        // Mock connection failure
        const failingClient = {
            ...mockClient,
            waitForConnection: Promise.resolve(false),
        };
        vi.mocked(clientsModule.createIFrameFrakClient).mockReturnValue(
            failingClient as unknown as FrakClient
        );

        // Execute
        const result = await setupClient({ config: mockConfig });

        // Verify
        expect(result).toBeUndefined();
        expect(console.error).toHaveBeenCalledWith(
            "Failed to connect to client"
        );
    });

    it("should wait for setup and connection before returning", async () => {
        // Create delayed promises with properly initialized resolvers
        let setupResolveFn = (_: void | PromiseLike<void>): void => {};
        let connectionResolveFn = (
            _: boolean | PromiseLike<boolean>
        ): void => {};

        const setupPromise = new Promise<void>((resolve) => {
            setupResolveFn = resolve;
        });

        const connectionPromise = new Promise<boolean>((resolve) => {
            connectionResolveFn = resolve;
        });

        // Client with delayed promises
        const delayedClient = {
            waitForSetup: setupPromise,
            waitForConnection: connectionPromise,
        } as unknown as FrakClient;

        vi.mocked(clientsModule.createIFrameFrakClient).mockReturnValue(
            delayedClient
        );

        // Start the setup
        const clientPromise = setupClient({ config: mockConfig });

        // Wait a tick to ensure createIframe and createIFrameFrakClient are called
        await Promise.resolve();

        // Should have been called
        expect(utilsModule.createIframe).toHaveBeenCalled();
        expect(clientsModule.createIFrameFrakClient).toHaveBeenCalled();

        // Check that client isn't resolved yet
        const immediateCheck = Promise.race([
            clientPromise.then(() => "resolved"),
            Promise.resolve("not resolved"),
        ]);
        expect(await immediateCheck).toBe("not resolved");
        // Resolve setup and verify still waiting
        setupResolveFn(undefined);
        await Promise.resolve(); // Wait a tick

        const afterSetupCheck = Promise.race([
            clientPromise.then(() => "resolved"),
            Promise.resolve("not resolved"),
        ]);
        expect(await afterSetupCheck).toBe("not resolved");

        // Resolve connection
        connectionResolveFn(true);

        // Now the client should resolve
        const result = await clientPromise;
        expect(result).toBe(delayedClient);
    });
});
