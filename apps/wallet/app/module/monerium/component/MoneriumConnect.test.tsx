/** @jsxImportSource react */
import type { MoneriumStatusResponse } from "@backend-domain/monerium/schemas";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { moneriumStatus } from "@/tests/moneriumFixtures";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({
    status: { current: undefined as MoneriumStatusResponse | undefined },
    disconnect: vi.fn(),
    disconnectError: { current: null as unknown },
    openModal: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/module/monerium/hooks/useMoneriumStatus", () => ({
    useMoneriumStatus: () => ({ status: mocks.status.current }),
}));
vi.mock("@/module/monerium/hooks/useMoneriumDisconnect", () => ({
    useMoneriumDisconnect: () => ({
        disconnect: mocks.disconnect,
        isPending: false,
        error: mocks.disconnectError.current,
    }),
}));
vi.mock("@/module/stores/modalStore", () => ({
    modalStore: (select: (s: { openModal: unknown }) => unknown) =>
        select({ openModal: mocks.openModal }),
}));

import { MoneriumConnect } from "./MoneriumConnect";

describe("MoneriumConnect", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.disconnectError.current = null;
    });

    test("Complete setup opens the bank flow next to Disconnect", () => {
        mocks.status.current = moneriumStatus({ walletLink: "none" });
        render(<MoneriumConnect />);

        fireEvent.click(screen.getByText("monerium.completeSetup"));
        expect(mocks.openModal).toHaveBeenCalledWith({
            id: "moneriumBankFlow",
        });
        expect(screen.getByText("monerium.disconnect")).toBeTruthy();
    });

    test.for([
        ["production", "pending", "linked", true],
        ["sandbox", "pending", "linked", false],
        ["production", "approved", "none", true],
        ["production", "approved", "pending", true],
        ["production", "approved", "linked", false],
    ] as const)(
        "%s, profile %s, wallet %s: Complete setup shown is %s",
        ([environment, state, walletLink, shown]) => {
            mocks.status.current = moneriumStatus({
                environment,
                walletLink,
                profile: { id: "p", kind: "personal", state },
            });
            render(<MoneriumConnect />);

            expect(!!screen.queryByText("monerium.completeSetup")).toBe(shown);
        }
    );

    test.for([
        ["none", "monerium.connect"],
        ["reauth_required", "monerium.reconnect"],
    ] as const)("a %s connection offers %s", ([connection, label]) => {
        mocks.status.current = moneriumStatus({ connection, profile: null });
        render(<MoneriumConnect />);

        fireEvent.click(screen.getByText(label));
        expect(mocks.openModal).toHaveBeenCalledWith({
            id: "moneriumBankFlow",
        });
        expect(screen.queryByText("monerium.disconnect")).toBeNull();
    });

    test("Disconnect only runs after the confirmation", async () => {
        mocks.status.current = moneriumStatus();
        render(<MoneriumConnect />);

        fireEvent.click(screen.getByText("monerium.disconnect"));
        expect(mocks.disconnect).not.toHaveBeenCalled();

        fireEvent.click(
            await screen.findByText("monerium.disconnectConfirm.confirm")
        );
        expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    });

    test("shows the disconnect failure", () => {
        mocks.status.current = moneriumStatus();
        mocks.disconnectError.current = new Error("boom");
        render(<MoneriumConnect />);
        expect(screen.getByText("monerium.errors.generic")).toBeTruthy();
    });
});
