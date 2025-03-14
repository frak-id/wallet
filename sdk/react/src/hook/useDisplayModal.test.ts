import { ClientNotFound, type ModalStepTypes } from "@frak-labs/core-sdk";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies - vi.mock calls are hoisted
vi.mock("./useFrakClient", () => ({
    useFrakClient: vi.fn(),
}));

// Mock displayModal function
const mockDisplayModal = vi.fn();
vi.mock("@frak-labs/core-sdk/actions", () => ({
    displayModal: () => mockDisplayModal(),
}));

// Mock useMutation
const mockMutate = vi.fn();
const mockMutateAsync = vi.fn();
const mockUseMutation = vi.fn();
vi.mock("@tanstack/react-query", () => ({
    useMutation: () => mockUseMutation(),
}));

import { useDisplayModal } from "./useDisplayModal";
// Import mocked dependencies
import { useFrakClient } from "./useFrakClient";

describe("useDisplayModal", () => {
    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Default mock implementation
        mockUseMutation.mockImplementation((config) => {
            if (!config || !config.mutationFn) {
                throw new Error("mutationFn is required");
            }
            return {
                mutate: mockMutate,
                mutateAsync: mockMutateAsync,
                isLoading: false,
                isError: false,
                error: null,
                mutationFn: config.mutationFn,
            };
        });

        // Mock client
        (useFrakClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            config: { domain: "test" },
        });

        // Mock displayModal success
        mockDisplayModal.mockResolvedValue({ result: "success" });
    });

    it("should call useMutation with the correct parameters", () => {
        renderHook(() => useDisplayModal());

        // Check mutation key
        expect(mockUseMutation).toHaveBeenCalledWith(
            expect.objectContaining({
                mutationKey: ["frak-sdk", "display-modal"],
            })
        );
    });

    it("should pass additional mutation options to useMutation", () => {
        const mockOptions = {
            onSuccess: vi.fn(),
            onError: vi.fn(),
        };

        renderHook(() => useDisplayModal({ mutations: mockOptions }));

        expect(mockUseMutation).toHaveBeenCalledWith(
            expect.objectContaining({
                onSuccess: mockOptions.onSuccess,
                onError: mockOptions.onError,
            })
        );
    });

    it("should throw ClientNotFound when client is not available", async () => {
        // Mock client as undefined
        (useFrakClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
            undefined
        );
        // Get mutation function
        let capturedMutationFn:
            | ((params: { steps: ModalStepTypes[] }) => Promise<{
                  result: string;
              }>)
            | undefined;
        mockUseMutation.mockImplementation(({ mutationFn }) => {
            capturedMutationFn = mutationFn;
            return { mutate: mockMutate };
        });

        renderHook(() => useDisplayModal());

        // Verify function was captured
        expect(capturedMutationFn).toBeDefined();

        // Check that it throws ClientNotFound
        if (capturedMutationFn) {
            await expect(
                capturedMutationFn({
                    steps: ["login" as unknown as ModalStepTypes],
                })
            ).rejects.toThrow(ClientNotFound);
        }
    });

    it("should call displayModal with client and modal params", async () => {
        const mockClient = { config: { domain: "test" } };
        const mockModalParams = {
            steps: [
                "login" as unknown as ModalStepTypes,
                "connect" as unknown as ModalStepTypes,
            ],
        };

        // Mock client
        (useFrakClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
            mockClient
        );

        // Get mutation function
        let capturedMutationFn:
            | ((params: { steps: ModalStepTypes[] }) => Promise<{
                  result: string;
              }>)
            | undefined;
        mockUseMutation.mockImplementation(({ mutationFn }) => {
            capturedMutationFn = mutationFn;
            return { mutate: mockMutate };
        });

        renderHook(() => useDisplayModal());

        // Verify function was captured
        expect(capturedMutationFn).toBeDefined();

        // Call the mutation function
        if (capturedMutationFn) {
            await capturedMutationFn(mockModalParams);
        }

        // Verify displayModal was called with correct params
        expect(mockDisplayModal).toHaveBeenCalledWith(
            mockClient,
            mockModalParams
        );
    });

    it("should return the result from displayModal", async () => {
        const expectedResult = { result: "success", user: { id: "123" } };
        mockDisplayModal.mockResolvedValue(expectedResult);

        // Get mutation function
        let capturedMutationFn:
            | ((params: { steps: ModalStepTypes[] }) => Promise<{
                  result: string;
              }>)
            | undefined;
        mockUseMutation.mockImplementation(({ mutationFn }) => {
            capturedMutationFn = mutationFn;
            return { mutate: mockMutate };
        });

        renderHook(() => useDisplayModal());

        // Call the mutation function
        if (capturedMutationFn) {
            const result = await capturedMutationFn({
                steps: ["login" as unknown as ModalStepTypes],
            });

            // Verify result
            expect(result).toEqual(expectedResult);
        }
    });
});
