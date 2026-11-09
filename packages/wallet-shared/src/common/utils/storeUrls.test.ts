import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ ios: false, android: false }));
vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    get IS_IOS() {
        return platform.ios;
    },
    get IS_ANDROID() {
        return platform.android;
    },
}));

vi.stubEnv("STAGE", "prod");
const { APP_STORE_URL, PLAY_STORE_URL, getRateAppUrl } = await import(
    "./storeUrls"
);

describe("getRateAppUrl", () => {
    beforeEach(() => {
        platform.ios = false;
        platform.android = false;
    });

    it("opens the App Store review form on iOS", () => {
        platform.ios = true;

        expect(getRateAppUrl()).toBe(`${APP_STORE_URL}?action=write-review`);
    });

    it("opens the Play Store listing on Android", () => {
        platform.android = true;

        expect(getRateAppUrl()).toBe(PLAY_STORE_URL);
    });
});
