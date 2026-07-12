import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import type { MerchantAdministrator } from "@/module/merchant/hook/useGetMerchantAdministrators";
import { describe, expect, test } from "@/tests/vitest-fixtures";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock("@frak-labs/react-sdk", () => ({
    useWalletStatus: () => ({ data: undefined }),
}));

const mockHasRole = vi.fn();
vi.mock("@/module/common/hook/useHasRoleOnMerchant", () => ({
    useHasRoleOnMerchant: () => mockHasRole(),
}));

const mockAdministrators = vi.fn();
vi.mock("@/module/merchant/hook/useGetMerchantAdministrators", () => ({
    useGetMerchantAdministrators: () => mockAdministrators(),
}));

const mockResend = vi.fn();
vi.mock("@/module/merchant/hook/useAdminMutation", () => ({
    useAdminMutation: () => ({ mutate: mockResend, isPending: false }),
}));

import { TableTeam } from "./index";

function admin(
    overrides: Partial<MerchantAdministrator> = {}
): MerchantAdministrator {
    return {
        id: "row-1",
        wallet: null,
        accountId: "acc-1",
        email: "member@test.com",
        addedBy: null,
        addedAt: new Date().toISOString(),
        isOwner: false,
        isMe: false,
        status: "active",
        ...overrides,
    };
}

function renderTable(admins: MerchantAdministrator[], hasAccess = true) {
    mockHasRole.mockReturnValue({ hasAccess });
    mockAdministrators.mockReturnValue({ data: admins, isLoading: false });
    return render(
        <TableTeam
            merchantId="merchant-1"
            stagedRemovals={[]}
            onToggleRemoval={vi.fn()}
        />
    );
}

describe("TableTeam", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    test("shows the Invited badge only for invited rows", () => {
        renderTable([
            admin({ id: "a", email: "active@test.com", status: "active" }),
            admin({ id: "b", email: "pending@test.com", status: "invited" }),
        ]);

        expect(screen.getAllByText("merchantEdit.team.invited")).toHaveLength(
            1
        );
    });

    test("shows the resend action only on invited rows for users with access", () => {
        renderTable([
            admin({ id: "a", email: "active@test.com", status: "active" }),
            admin({ id: "b", email: "pending@test.com", status: "invited" }),
        ]);

        const resendButtons = screen.getAllByLabelText(
            "merchantEdit.team.resendInvite"
        );
        expect(resendButtons).toHaveLength(1);
    });

    test("hides the resend action for viewers without merchant access", () => {
        renderTable(
            [admin({ email: "pending@test.com", status: "invited" })],
            false
        );

        expect(
            screen.queryByLabelText("merchantEdit.team.resendInvite")
        ).not.toBeInTheDocument();
    });

    test("resend re-calls the add mutation with the row email and reports success", () => {
        mockResend.mockImplementation(
            (
                _params: unknown,
                callbacks: { onSuccess: () => void; onError: () => void }
            ) => callbacks.onSuccess()
        );
        renderTable([admin({ email: "pending@test.com", status: "invited" })]);

        fireEvent.click(
            screen.getByLabelText("merchantEdit.team.resendInvite")
        );

        expect(mockResend).toHaveBeenCalledWith(
            { merchantId: "merchant-1", email: "pending@test.com" },
            expect.anything()
        );
        expect(
            screen.getByText("merchantEdit.team.resendSuccess")
        ).toBeInTheDocument();
    });

    test("resend failure surfaces the error message", () => {
        mockResend.mockImplementation(
            (
                _params: unknown,
                callbacks: { onSuccess: () => void; onError: () => void }
            ) => callbacks.onError()
        );
        renderTable([admin({ email: "pending@test.com", status: "invited" })]);

        fireEvent.click(
            screen.getByLabelText("merchantEdit.team.resendInvite")
        );

        expect(
            screen.getByText("merchantEdit.team.resendError")
        ).toBeInTheDocument();
    });
});
