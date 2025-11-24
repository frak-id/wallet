import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchClientReadyEvent, onClientReady } from "./clientReady";

describe("clientReady", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset window.FrakSetup
        window.FrakSetup = {
            client: undefined,
        } as any;
    });

    describe("dispatchClientReadyEvent", () => {
        it("should dispatch custom event", () => {
            const dispatchSpy = vi.spyOn(window, "dispatchEvent");

            dispatchClientReadyEvent();

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "frakClientReady",
                })
            );
        });
    });

    describe("onClientReady", () => {
        it("should execute callback immediately if client already exists", () => {
            window.FrakSetup.client = {
                config: {},
            } as any;

            const callback = vi.fn();
            const addEventListenerSpy = vi.spyOn(window, "addEventListener");

            onClientReady("add", callback);

            expect(callback).toHaveBeenCalledTimes(1);
            expect(addEventListenerSpy).not.toHaveBeenCalled();
        });

        it("should add event listener when client does not exist", () => {
            window.FrakSetup.client = undefined;

            const callback = vi.fn();
            const addEventListenerSpy = vi.spyOn(window, "addEventListener");

            onClientReady("add", callback);

            expect(callback).not.toHaveBeenCalled();
            expect(addEventListenerSpy).toHaveBeenCalledWith(
                "frakClientReady",
                callback,
                false
            );
        });

        it("should remove event listener when action is remove", () => {
            const callback = vi.fn();
            const removeEventListenerSpy = vi.spyOn(
                window,
                "removeEventListener"
            );

            onClientReady("remove", callback);

            expect(removeEventListenerSpy).toHaveBeenCalledWith(
                "frakClientReady",
                callback,
                false
            );
        });

        it("should handle event when client becomes ready", () => {
            window.FrakSetup.client = undefined;

            const callback = vi.fn();
            onClientReady("add", callback);

            // Simulate client becoming ready by dispatching event
            dispatchClientReadyEvent();

            // The callback should be called via the event listener
            expect(callback).toHaveBeenCalled();
        });
    });
});
