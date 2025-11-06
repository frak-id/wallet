/**
 * Tests for iframe helper utilities
 * Tests iframe creation, visibility management, and finder functions
 */

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "../../tests/vitest-fixtures";
import type { FrakWalletSdkConfig } from "../types";
import {
    baseIframeProps,
    changeIframeVisibility,
    createIframe,
    findIframeInOpener,
} from "./iframeHelper";

describe("iframeHelper", () => {
    describe("baseIframeProps", () => {
        it("should have correct id and name", () => {
            expect(baseIframeProps.id).toBe("frak-wallet");
            expect(baseIframeProps.name).toBe("frak-wallet");
        });

        it("should have correct title", () => {
            expect(baseIframeProps.title).toBe("Frak Wallet");
        });

        it("should have correct allow attribute", () => {
            expect(baseIframeProps.allow).toContain(
                "publickey-credentials-get"
            );
            expect(baseIframeProps.allow).toContain("clipboard-write");
            expect(baseIframeProps.allow).toContain("web-share");
        });

        it("should have correct initial style", () => {
            expect(baseIframeProps.style.width).toBe("0");
            expect(baseIframeProps.style.height).toBe("0");
            expect(baseIframeProps.style.border).toBe("0");
            expect(baseIframeProps.style.position).toBe("absolute");
            expect(baseIframeProps.style.zIndex).toBe(2000001);
        });
    });

    describe("createIframe", () => {
        let mockIframe: HTMLIFrameElement;
        let appendChildSpy: ReturnType<typeof vi.fn>;
        let querySelectorSpy: ReturnType<typeof vi.fn>;
        let createElementSpy: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            // Create mock iframe
            mockIframe = {
                id: "",
                name: "",
                allow: "",
                src: "",
                style: {} as CSSStyleDeclaration,
                addEventListener: vi.fn((event, handler) => {
                    if (event === "load") {
                        // Simulate immediate load
                        setTimeout(() => handler(), 0);
                    }
                }),
                remove: vi.fn(),
            } as unknown as HTMLIFrameElement;

            // Mock document methods
            createElementSpy = vi
                .spyOn(document, "createElement")
                .mockReturnValue(mockIframe);
            querySelectorSpy = vi
                .spyOn(document, "querySelector")
                .mockReturnValue(null);
            appendChildSpy = vi
                .spyOn(document.body, "appendChild")
                .mockReturnValue(mockIframe);
        });

        afterEach(() => {
            createElementSpy.mockRestore();
            querySelectorSpy.mockRestore();
            appendChildSpy.mockRestore();
        });

        it("should create iframe with correct properties", async () => {
            await createIframe({});

            expect(document.createElement).toHaveBeenCalledWith("iframe");
            expect(mockIframe.id).toBe("frak-wallet");
            expect(mockIframe.name).toBe("frak-wallet");
            expect(mockIframe.allow).toContain("publickey-credentials-get");
        });

        it("should append iframe to document body", async () => {
            await createIframe({});

            expect(document.body.appendChild).toHaveBeenCalledWith(mockIframe);
        });

        it("should set iframe src to default wallet URL", async () => {
            await createIframe({});

            expect(mockIframe.src).toBe("https://wallet.frak.id/listener");
        });

        it("should use config walletUrl when provided", async () => {
            const config: FrakWalletSdkConfig = {
                walletUrl: "https://custom-wallet.com",
                metadata: { name: "Test" },
            };

            await createIframe({ config });

            expect(mockIframe.src).toBe("https://custom-wallet.com/listener");
        });

        it("should use deprecated walletBaseUrl when provided", async () => {
            await createIframe({ walletBaseUrl: "https://legacy-wallet.com" });

            expect(mockIframe.src).toBe("https://legacy-wallet.com/listener");
        });

        it("should prefer config.walletUrl over walletBaseUrl", async () => {
            const config: FrakWalletSdkConfig = {
                walletUrl: "https://new-wallet.com",
                metadata: { name: "Test" },
            };

            await createIframe({
                walletBaseUrl: "https://old-wallet.com",
                config,
            });

            expect(mockIframe.src).toBe("https://new-wallet.com/listener");
        });

        it("should remove existing iframe before creating new one", async () => {
            const existingIframe = {
                remove: vi.fn(),
            } as unknown as HTMLIFrameElement;

            querySelectorSpy.mockReturnValue(existingIframe);

            await createIframe({});

            expect(document.querySelector).toHaveBeenCalledWith("#frak-wallet");
            expect(existingIframe.remove).toHaveBeenCalled();
        });

        it("should resolve promise on iframe load", async () => {
            const result = await createIframe({});

            expect(result).toBe(mockIframe);
        });

        it("should set iframe as initially hidden", async () => {
            await createIframe({});

            // Check that hidden styles were applied
            expect(mockIframe.style.width).toBe("0");
            expect(mockIframe.style.height).toBe("0");
        });

        it("should set zIndex from baseIframeProps", async () => {
            await createIframe({});

            expect(mockIframe.style.zIndex).toBe("2000001");
        });
    });

    describe("changeIframeVisibility", () => {
        let mockIframe: HTMLIFrameElement;

        beforeEach(() => {
            mockIframe = {
                style: {} as CSSStyleDeclaration,
            } as HTMLIFrameElement;
        });

        describe("when hiding iframe (isVisible: false)", () => {
            it("should set width and height to 0", () => {
                changeIframeVisibility({
                    iframe: mockIframe,
                    isVisible: false,
                });

                expect(mockIframe.style.width).toBe("0");
                expect(mockIframe.style.height).toBe("0");
            });

            it("should set border to 0", () => {
                changeIframeVisibility({
                    iframe: mockIframe,
                    isVisible: false,
                });

                expect(mockIframe.style.border).toBe("0");
            });

            it("should set position to fixed", () => {
                changeIframeVisibility({
                    iframe: mockIframe,
                    isVisible: false,
                });

                expect(mockIframe.style.position).toBe("fixed");
            });

            it("should move iframe off-screen", () => {
                changeIframeVisibility({
                    iframe: mockIframe,
                    isVisible: false,
                });

                expect(mockIframe.style.top).toBe("-1000px");
                expect(mockIframe.style.left).toBe("-1000px");
            });
        });

        describe("when showing iframe (isVisible: true)", () => {
            it("should set full screen dimensions", () => {
                changeIframeVisibility({ iframe: mockIframe, isVisible: true });

                expect(mockIframe.style.width).toBe("100%");
                expect(mockIframe.style.height).toBe("100%");
            });

            it("should position at top-left", () => {
                changeIframeVisibility({ iframe: mockIframe, isVisible: true });

                expect(mockIframe.style.top).toBe("0");
                expect(mockIframe.style.left).toBe("0");
            });

            it("should set position to fixed", () => {
                changeIframeVisibility({ iframe: mockIframe, isVisible: true });

                expect(mockIframe.style.position).toBe("fixed");
            });

            it("should enable pointer events", () => {
                changeIframeVisibility({ iframe: mockIframe, isVisible: true });

                expect(mockIframe.style.pointerEvents).toBe("auto");
            });
        });

        describe("toggling visibility", () => {
            it("should hide then show correctly", () => {
                changeIframeVisibility({ iframe: mockIframe, isVisible: true });
                expect(mockIframe.style.width).toBe("100%");

                changeIframeVisibility({
                    iframe: mockIframe,
                    isVisible: false,
                });
                expect(mockIframe.style.width).toBe("0");
            });

            it("should show then hide correctly", () => {
                changeIframeVisibility({
                    iframe: mockIframe,
                    isVisible: false,
                });
                expect(mockIframe.style.top).toBe("-1000px");

                changeIframeVisibility({ iframe: mockIframe, isVisible: true });
                expect(mockIframe.style.top).toBe("0");
            });
        });
    });

    describe("findIframeInOpener", () => {
        let originalOpener: Window;
        let consoleErrorSpy: any;

        beforeEach(() => {
            originalOpener = window.opener;
            consoleErrorSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});
        });

        afterEach(() => {
            window.opener = originalOpener;
            consoleErrorSpy.mockRestore();
        });

        it("should return null when window.opener is not available", () => {
            window.opener = null;

            const result = findIframeInOpener();

            expect(result).toBeNull();
        });

        it("should find iframe in window.opener with default pathname", () => {
            const mockOpener = {
                location: {
                    origin: window.location.origin,
                    pathname: "/listener",
                },
                frames: [],
            } as unknown as Window;

            window.opener = mockOpener;

            const result = findIframeInOpener();

            expect(result).toBe(mockOpener);
        });

        it("should find iframe with custom pathname", () => {
            const mockOpener = {
                location: {
                    origin: window.location.origin,
                    pathname: "/custom-iframe",
                },
                frames: [],
            } as unknown as Window;

            window.opener = mockOpener;

            const result = findIframeInOpener("/custom-iframe");

            expect(result).toBe(mockOpener);
        });

        it("should search through frames in window.opener", () => {
            const matchingFrame = {
                location: {
                    origin: window.location.origin,
                    pathname: "/listener",
                },
            } as unknown as Window;

            const nonMatchingFrame = {
                location: {
                    origin: window.location.origin,
                    pathname: "/other",
                },
            } as unknown as Window;

            const mockOpener = {
                location: {
                    origin: window.location.origin,
                    pathname: "/parent",
                },
                frames: [nonMatchingFrame, matchingFrame],
                length: 2,
            } as unknown as Window;

            window.opener = mockOpener;

            const result = findIframeInOpener();

            expect(result).toBe(matchingFrame);
        });

        it("should return null when no matching frame is found", () => {
            const mockOpener = {
                location: {
                    origin: window.location.origin,
                    pathname: "/wrong",
                },
                frames: [],
            } as unknown as Window;

            window.opener = mockOpener;

            const result = findIframeInOpener("/listener");

            expect(result).toBeNull();
        });

        it("should handle cross-origin frames gracefully", () => {
            const crossOriginFrame = {
                get location() {
                    throw new Error(
                        "SecurityError: Blocked a frame with origin"
                    );
                },
            } as unknown as Window;

            const mockOpener = {
                location: {
                    origin: window.location.origin,
                    pathname: "/parent",
                },
                frames: [crossOriginFrame],
                length: 1,
            } as unknown as Window;

            window.opener = mockOpener;

            const result = findIframeInOpener();

            expect(result).toBeNull();
        });

        it("should handle errors during frame search", () => {
            const mockOpener = {
                location: {
                    origin: window.location.origin,
                    pathname: "/parent",
                },
                get frames() {
                    throw new Error("Access denied");
                },
            } as unknown as Window;

            window.opener = mockOpener;

            const result = findIframeInOpener();

            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it("should match origin correctly", () => {
            const wrongOriginFrame = {
                location: {
                    origin: "https://different-origin.com",
                    pathname: "/listener",
                },
            } as unknown as Window;

            const mockOpener = {
                location: {
                    origin: "https://different-origin.com",
                    pathname: "/parent",
                },
                frames: [wrongOriginFrame],
                length: 1,
            } as unknown as Window;

            window.opener = mockOpener;

            const result = findIframeInOpener();

            expect(result).toBeNull();
        });
    });
});
