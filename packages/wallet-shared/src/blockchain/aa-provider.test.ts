import { describe, expect, it, vi } from "vitest";

vi.mock("@frak-labs/app-essentials/blockchain", () => ({
    getErpcTransport: vi.fn(),
}));

vi.mock("viem", () => ({
    createClient: vi.fn(),
    fallback: vi.fn(),
    http: vi.fn(),
}));

vi.mock("./provider", () => ({
    currentChain: {
        id: 1,
        name: "Ethereum",
    },
}));

describe("aa-provider", () => {
    describe("getPimlicoTransport", () => {
        it("should create transport with Pimlico API", async () => {
            const { getPimlicoTransport } = await import("./aa-provider");
            const { http } = await import("viem");

            const mockHttpTransport = { type: "http" };
            vi.mocked(http).mockReturnValue(mockHttpTransport as any);

            const transport = getPimlicoTransport();

            expect(transport).toBeDefined();
        });

        it("should return consistent transport due to memoization", async () => {
            const { getPimlicoTransport } = await import("./aa-provider");

            const transport1 = getPimlicoTransport();
            const transport2 = getPimlicoTransport();

            expect(transport1).toBe(transport2);
        });
    });

    describe("getPimlicoClient", () => {
        it("should create client with transport", async () => {
            const { getPimlicoClient } = await import("./aa-provider");
            const { createClient } = await import("viem");

            vi.mocked(createClient).mockReturnValue({ type: "client" } as any);

            const client = getPimlicoClient();

            expect(client).toBeDefined();
        });

        it("should return consistent client due to memoization", async () => {
            const { getPimlicoClient } = await import("./aa-provider");

            const client1 = getPimlicoClient();
            const client2 = getPimlicoClient();

            expect(client1).toBe(client2);
        });
    });
});
