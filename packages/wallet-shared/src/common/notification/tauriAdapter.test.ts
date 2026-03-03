import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTauriNotificationAdapter } from "./tauriAdapter";

const {
    sendNotificationMock,
    isPermissionGrantedMock,
    requestPermissionMock,
    createChannelMock,
} = vi.hoisted(() => ({
    sendNotificationMock: vi.fn(),
    isPermissionGrantedMock: vi.fn(),
    requestPermissionMock: vi.fn(),
    createChannelMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-notification", () => ({
    sendNotification: sendNotificationMock,
    isPermissionGranted: isPermissionGrantedMock,
    requestPermission: requestPermissionMock,
    createChannel: createChannelMock,
}));

const { isAndroidMock } = vi.hoisted(() => ({
    isAndroidMock: vi.fn(),
}));

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    isAndroid: isAndroidMock,
    isTauri: vi.fn().mockReturnValue(true),
}));

const { addMock } = vi.hoisted(() => ({
    addMock: vi.fn(),
}));

vi.mock("../storage/notifications", () => ({
    notificationStorage: {
        add: addMock,
    },
}));

describe.sequential("createTauriNotificationAdapter", () => {
    const mockUUID = "test-uuid-1234-5678";

    beforeEach(() => {
        sendNotificationMock.mockReset();
        isPermissionGrantedMock.mockReset();
        requestPermissionMock.mockReset();
        createChannelMock.mockReset();
        isAndroidMock.mockReset();
        addMock.mockReset();

        vi.stubGlobal("crypto", {
            randomUUID: vi.fn().mockReturnValue(mockUUID),
        });
    });

    it("should return true for isSupported", () => {
        const adapter = createTauriNotificationAdapter();

        expect(adapter.isSupported()).toBe(true);
    });

    it("should return 'default' for getPermissionStatus initially", () => {
        const adapter = createTauriNotificationAdapter();

        expect(adapter.getPermissionStatus()).toBe("default");
    });

    it("should return 'granted' for getPermissionStatus after initialize when permission is granted", async () => {
        isPermissionGrantedMock.mockResolvedValue(true);
        isAndroidMock.mockReturnValue(false);

        const adapter = createTauriNotificationAdapter();
        await adapter.initialize();

        expect(adapter.getPermissionStatus()).toBe("granted");
    });

    it("should call plugin requestPermission and return 'granted'", async () => {
        requestPermissionMock.mockResolvedValue("granted");

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.requestPermission();

        expect(requestPermissionMock).toHaveBeenCalledOnce();
        expect(result).toBe("granted");
    });

    it("should call plugin requestPermission and return 'denied'", async () => {
        requestPermissionMock.mockResolvedValue("denied");

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.requestPermission();

        expect(requestPermissionMock).toHaveBeenCalledOnce();
        expect(result).toBe("denied");
    });

    it("should call requestPermission internally when subscribing", async () => {
        requestPermissionMock.mockResolvedValue("granted");

        const adapter = createTauriNotificationAdapter();
        await adapter.subscribe();

        expect(requestPermissionMock).toHaveBeenCalledOnce();
    });

    it("should not throw when unsubscribing (no-op)", async () => {
        const adapter = createTauriNotificationAdapter();

        await expect(adapter.unsubscribe()).resolves.toBeUndefined();
    });

    it("should return false for isSubscribed initially", async () => {
        const adapter = createTauriNotificationAdapter();

        const result = await adapter.isSubscribed();

        expect(result).toBe(false);
    });

    it("should return true for isSubscribed after permission granted", async () => {
        isPermissionGrantedMock.mockResolvedValue(true);
        isAndroidMock.mockReturnValue(false);

        const adapter = createTauriNotificationAdapter();
        await adapter.initialize();
        const result = await adapter.isSubscribed();

        expect(result).toBe(true);
    });

    it("should check permission and create Android channel when isAndroid is true", async () => {
        isPermissionGrantedMock.mockResolvedValue(true);
        isAndroidMock.mockReturnValue(true);

        const adapter = createTauriNotificationAdapter();
        await adapter.initialize();

        expect(isPermissionGrantedMock).toHaveBeenCalledOnce();
        expect(createChannelMock).toHaveBeenCalledWith({
            id: "default",
            name: "Frak Wallet",
            importance: 4,
        });
    });

    it("should not create channel when isAndroid is false", async () => {
        isPermissionGrantedMock.mockResolvedValue(true);
        isAndroidMock.mockReturnValue(false);

        const adapter = createTauriNotificationAdapter();
        await adapter.initialize();

        expect(isPermissionGrantedMock).toHaveBeenCalledOnce();
        expect(createChannelMock).not.toHaveBeenCalled();
    });

    it("should return isSubscribed true when permission granted on initialize", async () => {
        isPermissionGrantedMock.mockResolvedValue(true);
        isAndroidMock.mockReturnValue(false);

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.initialize();

        expect(result).toEqual({ isSubscribed: true });
    });

    it("should return isSubscribed false when permission denied on initialize", async () => {
        isPermissionGrantedMock.mockResolvedValue(false);
        isAndroidMock.mockReturnValue(false);

        const adapter = createTauriNotificationAdapter();
        const result = await adapter.initialize();

        expect(result).toEqual({ isSubscribed: false });
    });

    it("should call sendNotification with mapped payload", async () => {
        const adapter = createTauriNotificationAdapter();

        await adapter.showLocalNotification({
            title: "Test Title",
            body: "Test Body",
            icon: "test-icon.png",
        });

        expect(sendNotificationMock).toHaveBeenCalledWith({
            title: "Test Title",
            body: "Test Body",
            icon: "test-icon.png",
        });
    });

    it("should call notificationStorage.add with correct NotificationModel shape", async () => {
        const now = 1700000000000;
        vi.spyOn(Date, "now").mockReturnValue(now);

        const adapter = createTauriNotificationAdapter();

        await adapter.showLocalNotification({
            title: "Test Title",
            body: "Test Body",
            icon: "test-icon.png",
            data: { url: "https://example.com" },
        });

        expect(addMock).toHaveBeenCalledWith({
            id: mockUUID,
            title: "Test Title",
            body: "Test Body",
            icon: "test-icon.png",
            data: { url: "https://example.com" },
            timestamp: now,
        });
    });
});
