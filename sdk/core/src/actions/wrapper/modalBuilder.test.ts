import { vi } from "vitest";

vi.mock("../displayModal", () => ({
    displayModal: vi.fn(),
}));

import type { Address } from "viem";
import { describe, expect, it } from "../../../tests/vitest-fixtures";
import type { FrakClient } from "../../types";
import { modalBuilder } from "./modalBuilder";

describe("modalBuilder", () => {
    const mockClient = {
        config: {
            metadata: {
                name: "Test App",
            },
        },
        request: vi.fn(),
    } as unknown as FrakClient;

    describe("initialization", () => {
        it("should create builder with base params", () => {
            const builder = modalBuilder(mockClient, {});

            expect(builder.params).toBeDefined();
            expect(builder.params.steps.login).toEqual({});
            expect(builder.params.steps.openSession).toEqual({});
        });

        it("should create builder with custom login params", () => {
            const builder = modalBuilder(mockClient, {
                login: { allowSso: true },
            });

            expect(builder.params.steps.login).toEqual({ allowSso: true });
        });

        it("should create builder with custom openSession params", () => {
            const builder = modalBuilder(mockClient, {
                openSession: {},
            });

            expect(builder.params.steps.openSession).toEqual({});
        });

        it("should create builder with metadata", () => {
            const builder = modalBuilder(mockClient, {
                metadata: {
                    header: { title: "Test Title" },
                },
            });

            expect(builder.params.metadata).toEqual({
                header: { title: "Test Title" },
            });
        });
    });

    describe("sendTx step", () => {
        it("should add sendTransaction step", () => {
            const builder = modalBuilder(mockClient, {});
            const withTx = builder.sendTx({
                tx: {
                    to: "0x1234567890123456789012345678901234567890" as Address,
                    data: "0xdata" as `0x${string}`,
                },
            });

            expect(withTx.params.steps.sendTransaction).toEqual({
                tx: {
                    to: "0x1234567890123456789012345678901234567890",
                    data: "0xdata",
                },
            });
        });

        it("should preserve previous steps when adding sendTx", () => {
            const builder = modalBuilder(mockClient, {
                login: { allowSso: true },
            });
            const withTx = builder.sendTx({
                tx: {
                    to: "0x1234567890123456789012345678901234567890" as Address,
                },
            });

            expect(withTx.params.steps.login).toEqual({ allowSso: true });
            expect(withTx.params.steps.sendTransaction).toBeDefined();
        });
    });

    describe("reward step", () => {
        it("should add reward final step", () => {
            const builder = modalBuilder(mockClient, {});
            const withReward = builder.reward();

            expect(withReward.params.steps.final).toEqual({
                action: { key: "reward" },
            });
        });

        it("should add reward step with options", () => {
            const builder = modalBuilder(mockClient, {});
            const withReward = builder.reward({
                autoSkip: true,
            });

            expect(withReward.params.steps.final).toEqual({
                autoSkip: true,
                action: { key: "reward" },
            });
        });
    });

    describe("sharing step", () => {
        it("should add sharing final step", () => {
            const builder = modalBuilder(mockClient, {});
            const withSharing = builder.sharing({
                popupTitle: "Share!",
                text: "Check this out",
                link: "https://example.com",
            });

            expect(withSharing.params.steps.final).toEqual({
                action: {
                    key: "sharing",
                    options: {
                        popupTitle: "Share!",
                        text: "Check this out",
                        link: "https://example.com",
                    },
                },
            });
        });

        it("should add sharing step with additional options", () => {
            const builder = modalBuilder(mockClient, {});
            const withSharing = builder.sharing(
                { text: "Share text", link: "https://example.com" },
                { autoSkip: false }
            );

            expect(withSharing.params.steps.final).toEqual({
                autoSkip: false,
                action: {
                    key: "sharing",
                    options: {
                        text: "Share text",
                        link: "https://example.com",
                    },
                },
            });
        });
    });

    describe("chaining", () => {
        it("should chain sendTx and reward", () => {
            const builder = modalBuilder(mockClient, {});
            const chained = builder
                .sendTx({
                    tx: {
                        to: "0x1234567890123456789012345678901234567890" as Address,
                    },
                })
                .reward();

            expect(chained.params.steps.sendTransaction).toBeDefined();
            expect(chained.params.steps.final).toEqual({
                action: { key: "reward" },
            });
        });

        it("should chain sendTx and sharing", () => {
            const builder = modalBuilder(mockClient, {});
            const chained = builder
                .sendTx({
                    tx: {
                        to: "0x1234567890123456789012345678901234567890" as Address,
                    },
                })
                .sharing({ link: "https://example.com" });

            expect(chained.params.steps.sendTransaction).toBeDefined();
            expect(chained.params.steps.final?.action).toEqual({
                key: "sharing",
                options: { link: "https://example.com" },
            });
        });
    });

    describe("display", () => {
        it("should call displayModal when display is invoked", async () => {
            const { displayModal } = await import("../displayModal");

            const mockResponse = {
                login: {
                    wallet: "0x1234567890123456789012345678901234567890" as Address,
                },
                openSession: {
                    startTimestamp: 1234567890,
                    endTimestamp: 1234567900,
                },
            };
            vi.mocked(displayModal).mockResolvedValue(mockResponse as any);

            const builder = modalBuilder(mockClient, {});
            await builder.display();

            expect(displayModal).toHaveBeenCalledWith(
                mockClient,
                builder.params
            );
        });

        it("should apply metadata override when provided", async () => {
            const { displayModal } = await import("../displayModal");

            vi.mocked(displayModal).mockResolvedValue({} as any);

            const builder = modalBuilder(mockClient, {
                metadata: { header: { title: "Original" } },
            });
            await builder.display(() => ({
                header: { title: "Overridden" },
            }));

            expect(displayModal).toHaveBeenCalledWith(
                mockClient,
                expect.objectContaining({
                    metadata: { header: { title: "Overridden" } },
                })
            );
        });

        it("should return displayModal result", async () => {
            const { displayModal } = await import("../displayModal");

            const mockResponse = {
                login: {
                    wallet: "0x1234567890123456789012345678901234567890" as Address,
                },
                openSession: {},
            };
            vi.mocked(displayModal).mockResolvedValue(mockResponse as any);

            const builder = modalBuilder(mockClient, {});
            const result = await builder.display();

            expect(result).toEqual(mockResponse);
        });
    });
});
