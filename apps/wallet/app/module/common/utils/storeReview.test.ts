import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@frak-labs/wallet-shared", () => ({
    getInvoke: () => Promise.resolve(invoke),
}));

import { requestStoreReview } from "./storeReview";

describe("requestStoreReview", () => {
    beforeEach(() => {
        invoke.mockReset();
    });

    it("reports a prompt the native layer requested", async () => {
        invoke.mockResolvedValue({ requested: true });

        await expect(requestStoreReview()).resolves.toBe(true);
        expect(invoke).toHaveBeenCalledWith(
            "plugin:store-review|request_review"
        );
    });

    it("reports a prompt the native layer could not request", async () => {
        invoke.mockResolvedValue({ requested: false });

        await expect(requestStoreReview()).resolves.toBe(false);
    });

    it("reports false when the command is missing", async () => {
        invoke.mockRejectedValue(new Error("command not found"));

        await expect(requestStoreReview()).resolves.toBe(false);
    });
});
