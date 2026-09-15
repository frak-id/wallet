import { describe, expect, it, vi } from "vitest";

vi.mock("@frak-labs/app-essentials/blockchain", () => ({
    getErpcTransport: vi.fn(),
}));

vi.mock("viem", () => ({
    createClient: vi.fn(() => ({ type: "client" })),
    fallback: vi.fn(),
    http: vi.fn(() => ({ type: "http" })),
}));

vi.mock("./provider", () => ({
    currentChain: {
        id: 1,
        name: "Ethereum",
    },
}));

describe("aa-provider", () => {
    it("memoizes the pimlico transport", async () => {
        const { getPimlicoTransport } = await import("./aa-provider");
        const { http } = await import("viem");

        const transport = getPimlicoTransport();

        expect(transport).toEqual({ type: "http" });
        expect(getPimlicoTransport()).toBe(transport);
        expect(http).toHaveBeenCalledTimes(1);
    });

    it("memoizes the pimlico client", async () => {
        const { getPimlicoClient } = await import("./aa-provider");
        const { createClient } = await import("viem");

        const client = getPimlicoClient();

        expect(client).toEqual({ type: "client" });
        expect(getPimlicoClient()).toBe(client);
        expect(createClient).toHaveBeenCalledTimes(1);
    });
});
