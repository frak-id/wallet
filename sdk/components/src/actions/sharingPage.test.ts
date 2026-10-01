import { displaySharingPage } from "@frak-labs/core-sdk/actions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openSharingPage } from "./sharingPage";

vi.mock("@frak-labs/core-sdk/actions", () => ({
    displaySharingPage: vi.fn(async () => ({ action: "dismissed" })),
}));

describe("openSharingPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.FrakSetup = { client: { config: {} } } as never;
    });

    it("forwards the checkout token to the RPC payload", async () => {
        await openSharingPage("post_purchase", undefined, undefined, {
            link: "https://acme.example/shoes",
            checkoutToken: "tok-1",
        });

        expect(displaySharingPage).toHaveBeenCalledWith(
            window.FrakSetup?.client,
            {
                link: "https://acme.example/shoes",
                checkoutToken: "tok-1",
                metadata: { entryPoint: "post_purchase" },
            },
            undefined
        );
    });

    it("sends the entry point alongside the target interaction", async () => {
        await openSharingPage("share_button", "custom.customerMeeting", "hero");

        expect(displaySharingPage).toHaveBeenCalledWith(
            window.FrakSetup?.client,
            {
                metadata: {
                    entryPoint: "share_button",
                    targetInteraction: "custom.customerMeeting",
                },
            },
            "hero"
        );
    });

    it("omits the key entirely rather than sending an undefined token", async () => {
        await openSharingPage("post_purchase", undefined, undefined, {
            link: "https://acme.example/shoes",
            checkoutToken: undefined,
        });

        const payload = vi.mocked(displaySharingPage).mock.calls[0]?.[1];
        expect(payload).not.toHaveProperty("checkoutToken");
    });

    it("reports a failed RPC instead of rejecting to an unawaited caller", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        vi.mocked(displaySharingPage).mockRejectedValueOnce(
            new Error("closed")
        );

        await expect(openSharingPage("ambassador")).resolves.toBeUndefined();
        expect(error).toHaveBeenCalled();
        error.mockRestore();
    });
});
