import { beforeEach, describe, expect, it, vi } from "vitest";
import { isConnectedVideoDevices } from "./isConnectedVideoDevices";

describe("isConnectedVideoDevices", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return true when video devices are available", async () => {
        const mockEnumerateDevices = vi.fn().mockResolvedValue([
            { kind: "videoinput", deviceId: "camera1", label: "Front Camera" },
            { kind: "audioinput", deviceId: "mic1", label: "Microphone" },
            { kind: "videoinput", deviceId: "camera2", label: "Back Camera" },
        ]);

        Object.defineProperty(navigator, "mediaDevices", {
            value: { enumerateDevices: mockEnumerateDevices },
            writable: true,
            configurable: true,
        });

        const result = await isConnectedVideoDevices();

        expect(result).toBe(true);
        expect(mockEnumerateDevices).toHaveBeenCalledTimes(1);
    });

    it("should return false when no video devices are available", async () => {
        const mockEnumerateDevices = vi.fn().mockResolvedValue([
            { kind: "audioinput", deviceId: "mic1", label: "Microphone" },
            { kind: "audiooutput", deviceId: "speaker1", label: "Speaker" },
        ]);

        Object.defineProperty(navigator, "mediaDevices", {
            value: { enumerateDevices: mockEnumerateDevices },
            writable: true,
            configurable: true,
        });

        const result = await isConnectedVideoDevices();

        expect(result).toBe(false);
        expect(mockEnumerateDevices).toHaveBeenCalledTimes(1);
    });

    it("should return false when device list is empty", async () => {
        const mockEnumerateDevices = vi.fn().mockResolvedValue([]);

        Object.defineProperty(navigator, "mediaDevices", {
            value: { enumerateDevices: mockEnumerateDevices },
            writable: true,
            configurable: true,
        });

        const result = await isConnectedVideoDevices();

        expect(result).toBe(false);
    });

    it("should count only videoinput devices", async () => {
        const mockEnumerateDevices = vi.fn().mockResolvedValue([
            { kind: "videoinput", deviceId: "camera1" },
            { kind: "audioinput", deviceId: "mic1" },
            { kind: "audiooutput", deviceId: "speaker1" },
            { kind: "videoinput", deviceId: "camera2" },
        ]);

        Object.defineProperty(navigator, "mediaDevices", {
            value: { enumerateDevices: mockEnumerateDevices },
            writable: true,
            configurable: true,
        });

        const result = await isConnectedVideoDevices();

        expect(result).toBe(true);
    });

    it("should handle single video device", async () => {
        const mockEnumerateDevices = vi
            .fn()
            .mockResolvedValue([
                { kind: "videoinput", deviceId: "camera1", label: "Camera" },
            ]);

        Object.defineProperty(navigator, "mediaDevices", {
            value: { enumerateDevices: mockEnumerateDevices },
            writable: true,
            configurable: true,
        });

        const result = await isConnectedVideoDevices();

        expect(result).toBe(true);
    });

    it("should handle devices without labels", async () => {
        const mockEnumerateDevices = vi
            .fn()
            .mockResolvedValue([
                { kind: "videoinput", deviceId: "camera1", label: "" },
            ]);

        Object.defineProperty(navigator, "mediaDevices", {
            value: { enumerateDevices: mockEnumerateDevices },
            writable: true,
            configurable: true,
        });

        const result = await isConnectedVideoDevices();

        expect(result).toBe(true);
    });

    it("should return true with multiple video devices", async () => {
        const mockEnumerateDevices = vi.fn().mockResolvedValue([
            { kind: "videoinput", deviceId: "camera1" },
            { kind: "videoinput", deviceId: "camera2" },
            { kind: "videoinput", deviceId: "camera3" },
        ]);

        Object.defineProperty(navigator, "mediaDevices", {
            value: { enumerateDevices: mockEnumerateDevices },
            writable: true,
            configurable: true,
        });

        const result = await isConnectedVideoDevices();

        expect(result).toBe(true);
    });
});
