import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { describe, expect, test } from "@/tests/vitest-fixtures";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) =>
            options?.email ? `${key}:${options.email}` : key,
    }),
}));

const mockAddAdmin = vi.fn();
vi.mock("@/module/merchant/hook/useAdminMutation", () => ({
    useAdminMutation: () => ({
        mutate: mockAddAdmin,
        isPending: false,
        isError: false,
        error: null,
    }),
}));

import { ButtonAddTeam } from "./index";

function addTeamMember(email: string, status: "active" | "invited") {
    mockAddAdmin.mockImplementation(
        (_params: unknown, callbacks: { onSuccess: (data: unknown) => void }) =>
            callbacks.onSuccess({ id: "row-1", status })
    );

    render(
        <ButtonAddTeam merchantId="merchant-1">
            <button type="button">open</button>
        </ButtonAddTeam>
    );

    // Open the sheet (real Radix portal renders into document.body),
    // switch to the email tab and submit.
    fireEvent.click(screen.getByText("open"));
    // Radix TabsTrigger activates on mousedown, not click
    fireEvent.mouseDown(screen.getByText("merchantEdit.team.add.modeEmail"));
    fireEvent.click(screen.getByText("merchantEdit.team.add.modeEmail"));
    fireEvent.change(
        screen.getByPlaceholderText("merchantEdit.team.add.emailPlaceholder"),
        { target: { value: email } }
    );
    fireEvent.click(screen.getByText("merchantEdit.team.add.submit"));
}

describe("ButtonAddTeam", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    test("shows the direct-add notice when the email matched an existing account", () => {
        addTeamMember("existing@test.com", "active");

        expect(mockAddAdmin).toHaveBeenCalledWith(
            { merchantId: "merchant-1", email: "existing@test.com" },
            expect.anything()
        );
        expect(
            screen.getByText(
                "merchantEdit.team.add.addedSuccess:existing@test.com"
            )
        ).toBeInTheDocument();
    });

    test("shows the invitation-sent notice when the email was unknown", () => {
        addTeamMember("new@test.com", "invited");

        expect(
            screen.getByText(
                "merchantEdit.team.add.invitedSuccess:new@test.com"
            )
        ).toBeInTheDocument();
    });
});
