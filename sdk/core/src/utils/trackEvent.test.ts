/**
 * Tests for trackEvent utility function
 * Tests OpenPanel event tracking wrapper
 */

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "../../tests/vitest-fixtures";
import type { FrakClient } from "../types";
import { trackEvent } from "./trackEvent";

describe("trackEvent", () => {
    let mockClient: FrakClient;
    let consoleDebugSpy: any;

    beforeEach(() => {
        // Create mock client
        mockClient = {
            openPanel: {
                track: vi.fn(),
            },
        } as unknown as FrakClient;

        // Spy on console.debug
        consoleDebugSpy = vi
            .spyOn(console, "debug")
            .mockImplementation(() => {});
    });

    afterEach(() => {
        consoleDebugSpy.mockRestore();
    });

    describe("success cases", () => {
        it("should track event with client", () => {
            trackEvent(mockClient, "share_button_clicked");

            expect(mockClient.openPanel?.track).toHaveBeenCalledWith(
                "share_button_clicked",
                {}
            );
        });

        it("should track event with props", () => {
            const props = { userId: "123", page: "home" };
            trackEvent(mockClient, "wallet_button_clicked", props);

            expect(mockClient.openPanel?.track).toHaveBeenCalledWith(
                "wallet_button_clicked",
                props
            );
        });

        it("should track share_modal_error event", () => {
            const props = { error: "Network error" };
            trackEvent(mockClient, "share_modal_error", props);

            expect(mockClient.openPanel?.track).toHaveBeenCalledWith(
                "share_modal_error",
                props
            );
        });

        it("should track user_referred event", () => {
            trackEvent(mockClient, "user_referred");

            expect(mockClient.openPanel?.track).toHaveBeenCalledWith(
                "user_referred",
                {}
            );
        });
    });

    describe("without client", () => {
        it("should not throw when client is undefined", () => {
            expect(() => {
                trackEvent(undefined, "share_button_clicked");
            }).not.toThrow();
        });

        it("should log debug message when client is undefined", () => {
            trackEvent(undefined, "wallet_button_clicked");

            expect(consoleDebugSpy).toHaveBeenCalledWith(
                "[Frak] No client provided, skipping event tracking"
            );
        });

        it("should not call track when client is undefined", () => {
            const trackMock = vi.fn();
            const undefinedClient = undefined;

            trackEvent(undefinedClient, "share_button_clicked");

            expect(trackMock).not.toHaveBeenCalled();
        });
    });

    describe("error handling", () => {
        it("should catch and log errors from track()", () => {
            const error = new Error("Track failed");
            mockClient.openPanel = {
                track: vi.fn().mockImplementation(() => {
                    throw error;
                }),
            } as any;

            expect(() => {
                trackEvent(mockClient, "share_button_clicked");
            }).not.toThrow();

            expect(consoleDebugSpy).toHaveBeenCalledWith(
                "[Frak] Failed to track event:",
                "share_button_clicked",
                error
            );
        });

        it("should not throw when openPanel is undefined", () => {
            const clientWithoutPanel = {} as FrakClient;

            expect(() => {
                trackEvent(clientWithoutPanel, "wallet_button_clicked");
            }).not.toThrow();
        });
    });

    describe("edge cases", () => {
        it("should handle empty props object", () => {
            trackEvent(mockClient, "share_button_clicked", {});

            expect(mockClient.openPanel?.track).toHaveBeenCalledWith(
                "share_button_clicked",
                {}
            );
        });

        it("should handle complex props object", () => {
            const complexProps = {
                userId: "123",
                metadata: {
                    page: "home",
                    section: "header",
                },
                tags: ["tag1", "tag2"],
                timestamp: Date.now(),
            };

            trackEvent(mockClient, "user_referred", complexProps);

            expect(mockClient.openPanel?.track).toHaveBeenCalledWith(
                "user_referred",
                complexProps
            );
        });
    });
});
