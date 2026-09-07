import { displaySharingPage } from "@frak-labs/core-sdk/actions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openSharingPage } from "./sharingPage";

vi.mock("@frak-labs/core-sdk/actions", () => ({
    displaySharingPage: vi.fn(),
}));

describe("openSharingPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.FrakSetup = { client: { config: {} } } as never;
    });

    it("forwards the checkout token to the RPC payload", async () => {
        await openSharingPage(undefined, undefined, {
            link: "https://acme.example/shoes",
            checkoutToken: "tok-1",
        });

        expect(displaySharingPage).toHaveBeenCalledWith(
            window.FrakSetup?.client,
            {
                link: "https://acme.example/shoes",
                checkoutToken: "tok-1",
            },
            undefined
        );
    });

    it("omits the key entirely rather than sending an undefined token", async () => {
        await openSharingPage(undefined, undefined, {
            link: "https://acme.example/shoes",
            checkoutToken: undefined,
        });

        const payload = vi.mocked(displaySharingPage).mock.calls[0]?.[1];
        expect(payload).not.toHaveProperty("checkoutToken");
    });
});
