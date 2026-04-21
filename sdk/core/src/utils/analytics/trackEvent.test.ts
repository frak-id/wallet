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
} from "../../../tests/vitest-fixtures";
import type { FrakClient } from "../../types";
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
                undefined
            );
        });

        it("should track event with props", () => {
            const props = { placement: "footer" } as const;
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

        it("should track user_referred_started event", () => {
            trackEvent(mockClient, "user_referred_started");

            expect(mockClient.openPanel?.track).toHaveBeenCalledWith(
                "user_referred_started",
                undefined
            );
        });

        it("should track user_referred_completed event", () => {
            trackEvent(mockClient, "user_referred_completed", {
                status: "success",
            });

            expect(mockClient.openPanel?.track).toHaveBeenCalledWith(
                "user_referred_completed",
                { status: "success" }
            );
        });

        it("should track user_referred_error event", () => {
            trackEvent(mockClient, "user_referred_error", {
                reason: "test",
            });

            expect(mockClient.openPanel?.track).toHaveBeenCalledWith(
                "user_referred_error",
                { reason: "test" }
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
                status: "success" as const,
            };

            trackEvent(mockClient, "user_referred_completed", complexProps);

            expect(mockClient.openPanel?.track).toHaveBeenCalledWith(
                "user_referred_completed",
                complexProps
            );
        });
    });
});
