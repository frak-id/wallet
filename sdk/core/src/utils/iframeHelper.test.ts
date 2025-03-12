/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FrakWalletSdkConfig } from "../types";
import {
    baseIframeProps,
    changeIframeVisibility,
    createIframe,
} from "./iframeHelper";

describe("iframeHelper", () => {
    let mockIframe: Partial<HTMLIFrameElement>;
    let appendChildSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        // Clear the document body before each test
        document.body.innerHTML = "";

        // Create a basic mock iframe
        mockIframe = {
            id: "",
            name: "",
            allow: "",
            src: "",
            style: {} as CSSStyleDeclaration,
            addEventListener: vi.fn(),
            remove: vi.fn(),
        };

        // Mock document.createElement to return our mock iframe
        vi.spyOn(document, "createElement").mockImplementation(() => {
            return mockIframe as HTMLIFrameElement;
        });

        // Mock document.querySelector
        vi.spyOn(document, "querySelector").mockReturnValue(null);

        // Mock document.body.appendChild to avoid actual DOM operations
        // This is the key fix - replace the real appendChild with a mock
        appendChildSpy = vi.fn().mockReturnValue(document.body);
        document.body.appendChild = appendChildSpy;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("createIframe", () => {
        test("should create a new iframe with default configuration", async () => {
            // Set up addEventListener to trigger callback
            mockIframe.addEventListener = vi.fn((event, callback) => {
                if (event === "load" && typeof callback === "function") {
                    setTimeout(() => callback(new Event("load")), 0);
                }
            });

            const iframe = await createIframe({});

            // Verify createElement was called correctly
            expect(document.createElement).toHaveBeenCalledWith("iframe");

            // Verify iframe properties
            expect(mockIframe.id).toBe("nexus-wallet");
            expect(mockIframe.name).toBe("nexus-wallet");
            expect(mockIframe.allow).toBe(
                "publickey-credentials-get *; clipboard-write; web-share *"
            );
            expect(mockIframe.src).toBe("https://wallet.frak.id/listener");

            // Verify iframe was attached to document
            expect(appendChildSpy).toHaveBeenCalledWith(mockIframe);

            // Verify function returned the iframe
            expect(iframe).toBe(mockIframe);
        });

        test("should use provided walletBaseUrl parameter", async () => {
            mockIframe.addEventListener = vi.fn((event, callback) => {
                if (event === "load" && typeof callback === "function") {
                    setTimeout(() => callback(new Event("load")), 0);
                }
            });

            const customUrl = "https://custom-wallet-url.com";
            await createIframe({ walletBaseUrl: customUrl });

            expect(mockIframe.src).toBe(`${customUrl}/listener`);
        });

        test("should use provided walletUrl from config parameter", async () => {
            mockIframe.addEventListener = vi.fn((event, callback) => {
                if (event === "load" && typeof callback === "function") {
                    setTimeout(() => callback(new Event("load")), 0);
                }
            });

            const customUrl = "https://wallet-from-config.com";
            const config: FrakWalletSdkConfig = {
                walletUrl: customUrl,
                metadata: {
                    name: "Test App",
                },
            };

            await createIframe({ config });

            expect(mockIframe.src).toBe(`${customUrl}/listener`);
        });

        test("should prioritize config.walletUrl over walletBaseUrl", async () => {
            mockIframe.addEventListener = vi.fn((event, callback) => {
                if (event === "load" && typeof callback === "function") {
                    setTimeout(() => callback(new Event("load")), 0);
                }
            });

            const oldUrl = "https://old-url.com";
            const newUrl = "https://new-config-url.com";
            const config: FrakWalletSdkConfig = {
                walletUrl: newUrl,
                metadata: {
                    name: "Test App",
                },
            };

            await createIframe({
                walletBaseUrl: oldUrl,
                config,
            });

            expect(mockIframe.src).toBe(`${newUrl}/listener`);
        });

        test("should remove existing iframe if one exists", async () => {
            // Setup a pre-existing iframe
            const existingIframe = document.createElement("iframe");
            existingIframe.id = "nexus-wallet";
            const removeSpy = vi.spyOn(existingIframe, "remove");

            // Mock to return the existing iframe
            vi.spyOn(document, "querySelector").mockReturnValueOnce(
                existingIframe
            );

            // Setup for async resolution
            mockIframe.addEventListener = vi.fn((event, callback) => {
                if (event === "load" && typeof callback === "function") {
                    setTimeout(() => callback(new Event("load")), 0);
                }
            });

            await createIframe({});

            // Verify the existing iframe was removed
            expect(removeSpy).toHaveBeenCalled();
        });
    });

    describe("changeIframeVisibility", () => {
        test("should set iframe to invisible when isVisible is false", () => {
            const iframe = document.createElement("iframe");

            changeIframeVisibility({ iframe, isVisible: false });

            expect(iframe.style.width).toBe("0");
            expect(iframe.style.height).toBe("0");
            expect(iframe.style.border).toBe("0");
            expect(iframe.style.position).toBe("fixed");
            expect(iframe.style.top).toBe("-1000px");
            expect(iframe.style.left).toBe("-1000px");
        });

        test("should set iframe to visible when isVisible is true", () => {
            const iframe = document.createElement("iframe");

            changeIframeVisibility({ iframe, isVisible: true });

            expect(iframe.style.position).toBe("fixed");
            expect(iframe.style.top).toBe("0");
            expect(iframe.style.left).toBe("0");
            expect(iframe.style.width).toBe("100%");
            expect(iframe.style.height).toBe("100%");
            expect(iframe.style.pointerEvents).toBe("auto");
        });
    });

    describe("baseIframeProps", () => {
        test("should have the correct properties", () => {
            expect(baseIframeProps.id).toBe("nexus-wallet");
            expect(baseIframeProps.name).toBe("nexus-wallet");
            expect(baseIframeProps.allow).toBe(
                "publickey-credentials-get *; clipboard-write; web-share *"
            );
            expect(baseIframeProps.style).toEqual({
                width: "0",
                height: "0",
                border: "0",
                position: "absolute",
                zIndex: 2000001,
                top: "-1000px",
                left: "-1000px",
            });
        });
    });
});
