import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";
import { openInstagramDm } from "./openInstagramDm";

const mocks = vi.hoisted(() => ({
    isAndroid: vi.fn(() => true),
    invoke: vi.fn(),
    openExternalUrl: vi.fn(),
}));

vi.mock("@frak-labs/app-essentials/utils/platform", async (importOriginal) => ({
    ...(await importOriginal<
        typeof import("@frak-labs/app-essentials/utils/platform")
    >()),
    get IS_ANDROID() {
        return mocks.isAndroid();
    },
}));

vi.mock("@frak-labs/wallet-shared", () => ({
    getInvoke: async () => mocks.invoke,
    openExternalUrl: mocks.openExternalUrl,
}));

const DM_URL = "https://ig.me/m/frak_fr?ref=K7Q2PX";

describe("openInstagramDm", () => {
    beforeEach(() => {
        mocks.isAndroid.mockReturnValue(true);
        mocks.invoke.mockReset().mockResolvedValue(undefined);
        mocks.openExternalUrl.mockReset();
    });

    test("hands the DM link straight to the Instagram app on Android", async () => {
        await openInstagramDm("K7Q2PX");

        expect(mocks.invoke).toHaveBeenCalledWith(
            "plugin:frak-share|open_in_app",
            { url: DM_URL, packageName: "com.instagram.android" }
        );
        expect(mocks.openExternalUrl).not.toHaveBeenCalled();
    });

    test("falls back to the browser when the native command fails", async () => {
        mocks.invoke.mockRejectedValue(new Error("No Activity found"));

        await openInstagramDm("K7Q2PX");

        expect(mocks.openExternalUrl).toHaveBeenCalledWith(DM_URL);
    });

    test("opens the link through the browser off Android", async () => {
        mocks.isAndroid.mockReturnValue(false);

        await openInstagramDm("K7Q2PX");

        expect(mocks.invoke).not.toHaveBeenCalled();
        expect(mocks.openExternalUrl).toHaveBeenCalledWith(DM_URL);
    });
});
