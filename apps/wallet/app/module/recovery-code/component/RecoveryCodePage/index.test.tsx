/** @jsxImportSource react */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
// `vi` must come from "vitest" directly: `vi.mock` is hoisted above module
// imports, so routing it through the fixtures module would reference an
// uninitialized binding.
import { vi } from "vitest";
import { modalStore } from "@/module/stores/modalStore";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";
import { RecoveryCodePage } from "./index";

const { mockResolvePost, mockNavigate } = vi.hoisted(() => ({
    mockResolvePost: vi.fn(),
    mockNavigate: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared/common/api/backendClient", () => ({
    authenticatedBackendApi: {
        user: {
            identity: {
                "install-code": { resolve: { post: mockResolvePost } },
            },
        },
    },
}));

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => mockNavigate,
}));

function typeCode(code: string) {
    fireEvent.change(screen.getByLabelText("rewardCode.codeLabel"), {
        target: { value: code },
    });
}

describe("RecoveryCodePage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        modalStore.getState().closeModal();
    });

    test("an UNRESOLVED code never announces a recovered referral", async ({
        queryWrapper,
    }) => {
        mockResolvePost.mockResolvedValue({
            data: {
                merchantId: "merchant-1",
                merchant: { name: "Acme", domain: "acme.test" },
                outcome: "UNRESOLVED",
            },
            error: null,
        });
        const openModal = vi.spyOn(modalStore.getState(), "openModal");

        render(<RecoveryCodePage />, { wrapper: queryWrapper.wrapper });
        typeCode("ABC123");
        fireEvent.click(screen.getByText("rewardCode.validate"));

        await waitFor(() => expect(mockResolvePost).toHaveBeenCalled());
        expect(openModal).not.toHaveBeenCalled();
        await screen.findByText("rewardCode.error.unresolved");
    });

    test("a resolved code opens the success modal", async ({
        queryWrapper,
    }) => {
        mockResolvePost.mockResolvedValue({
            data: {
                merchantId: "merchant-1",
                merchant: { name: "Acme", domain: "acme.test" },
                ticket: "ticket-1",
            },
            error: null,
        });
        const openModal = vi.spyOn(modalStore.getState(), "openModal");

        render(<RecoveryCodePage />, { wrapper: queryWrapper.wrapper });
        typeCode("ABC123");
        fireEvent.click(screen.getByText("rewardCode.validate"));

        await waitFor(() =>
            expect(openModal).toHaveBeenCalledWith(
                expect.objectContaining({ id: "recoveryCodeSuccess" })
            )
        );
    });
});
