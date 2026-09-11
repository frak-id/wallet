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
    let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        mockClient = {
            openPanel: {
                track: vi.fn(),
            },
        } as unknown as FrakClient;

        consoleDebugSpy = vi
            .spyOn(console, "debug")
            .mockImplementation(() => {});
    });

    afterEach(() => {
        consoleDebugSpy.mockRestore();
    });

    it("should forward the event and its props to OpenPanel", () => {
        const props = {
            placement: "footer",
            click_action: "share-modal",
        } as const;
        trackEvent(mockClient, "share_button_clicked", props);

        expect(mockClient.openPanel?.track).toHaveBeenCalledWith(
            "share_button_clicked",
            props
        );
    });

    it("should not throw when client is undefined", () => {
        expect(() => {
            trackEvent(undefined, "share_button_clicked");
        }).not.toThrow();
    });

    it("should not throw when openPanel is undefined", () => {
        expect(() => {
            trackEvent({} as FrakClient, "share_button_clicked");
        }).not.toThrow();
    });

    it("should catch and log errors from track()", () => {
        const error = new Error("Track failed");
        mockClient.openPanel = {
            track: vi.fn().mockImplementation(() => {
                throw error;
            }),
        } as unknown as FrakClient["openPanel"];

        expect(() => {
            trackEvent(mockClient, "share_button_clicked");
        }).not.toThrow();

        expect(consoleDebugSpy).toHaveBeenCalledWith(
            "[Frak] Failed to track event:",
            "share_button_clicked",
            error
        );
    });
});
