/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
    FrakClient,
    ModalRpcMetadata,
    ModalRpcStepsResultType,
    ModalStepTypes,
} from "../../types";
import { displayModal } from "../displayModal";
import { modalBuilder } from "./modalBuilder";

// Mock displayModal
vi.mock("../displayModal", () => ({
    displayModal: vi.fn(),
}));

describe("modalBuilder", () => {
    // Mock client
    const mockClientMetadataName = "My App";
    const mockClient: FrakClient = {
        config: {
            metadata: {
                name: mockClientMetadataName,
            },
        },
    } as unknown as FrakClient;

    // Mock displayModal result
    const mockModalResult = {
        login: { wallet: "0x123" },
        openSession: { startTimestamp: 1000, endTimestamp: 2000 },
    } as unknown as ModalRpcStepsResultType<ModalStepTypes[]>;

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(displayModal).mockResolvedValue(mockModalResult);
    });

    it("should create a basic modal builder with default steps", () => {
        // Execute
        const builder = modalBuilder(mockClient, {});

        // Verify
        expect(builder.params).toEqual({
            steps: {
                login: {},
                openSession: {},
            },
            metadata: undefined,
        });
    });

    it("should create a builder with custom login and openSession parameters", () => {
        // Execute
        const builder = modalBuilder(mockClient, {
            login: { allowSso: true, ssoMetadata: {} },
            openSession: { metadata: { title: "Custom Session" } },
            metadata: { lang: "fr" },
        });

        // Verify
        expect(builder.params).toEqual({
            steps: {
                login: { allowSso: true, ssoMetadata: {} },
                openSession: { metadata: { title: "Custom Session" } },
            },
            metadata: { lang: "fr" },
        });
    });

    it("should add sendTx step to the builder", () => {
        // Execute
        const builder = modalBuilder(mockClient, {});
        const updatedBuilder = builder.sendTx({
            tx: [{ to: "0xdeadbeef", data: "0xdeadbeef" }],
        });

        // Verify
        expect(updatedBuilder.params.steps).toEqual({
            login: {},
            openSession: {},
            sendTransaction: {
                tx: [{ to: "0xdeadbeef", data: "0xdeadbeef" }],
            },
        });
    });

    it("should add reward step to the builder", () => {
        // Execute
        const builder = modalBuilder(mockClient, {});
        const updatedBuilder = builder.reward({
            autoSkip: true,
            metadata: { title: "Reward" },
        });

        // Verify
        expect(updatedBuilder.params.steps).toEqual({
            login: {},
            openSession: {},
            final: {
                autoSkip: true,
                metadata: { title: "Reward" },
                action: { key: "reward" },
            },
        });
    });

    it("should add sharing step to the builder", () => {
        // Execute
        const builder = modalBuilder(mockClient, {});
        const sharingOptions = {
            popupTitle: "Share with friends",
            text: "Check this out!",
            link: "https://example.com",
        };
        const updatedBuilder = builder.sharing(sharingOptions, {
            autoSkip: false,
        });

        // Verify
        expect(updatedBuilder.params.steps).toEqual({
            login: {},
            openSession: {},
            final: {
                autoSkip: false,
                action: {
                    key: "sharing",
                    options: sharingOptions,
                },
            },
        });
    });

    it("should chain multiple steps together", () => {
        // Execute
        const builder = modalBuilder(mockClient, {});
        const updatedBuilder = builder
            .sendTx({ tx: [{ to: "0xdeadbeef", data: "0xdeadbeef" }] })
            .reward();

        // Verify
        expect(updatedBuilder.params.steps).toEqual({
            login: {},
            openSession: {},
            sendTransaction: {
                tx: [{ to: "0xdeadbeef", data: "0xdeadbeef" }],
            },
            final: {
                action: { key: "reward" },
            },
        });
    });

    it("should call displayModal when display() is called", async () => {
        // Execute
        const builder = modalBuilder(mockClient, {});
        const result = await builder.display();

        // Verify
        expect(displayModal).toHaveBeenCalledWith(mockClient, {
            steps: {
                login: {},
                openSession: {},
            },
            metadata: undefined,
        });
        expect(result).toEqual(mockModalResult);
    });

    it("should apply metadata override when provided to display()", async () => {
        // Setup
        const initialMetadata = { lang: "en" } as ModalRpcMetadata;
        const builder = modalBuilder(mockClient, { metadata: initialMetadata });

        // Metadata override function
        const metadataOverride = (current?: ModalRpcMetadata) =>
            ({
                ...(current || {}),
                lang: "fr" as const,
                header: { title: "Override" },
            }) as ModalRpcMetadata;

        // Execute
        await builder.display(metadataOverride);

        // Verify
        expect(displayModal).toHaveBeenCalledWith(mockClient, {
            steps: {
                login: {},
                openSession: {},
            },
            metadata: {
                lang: "fr",
                header: { title: "Override" },
            },
        });
    });
});
