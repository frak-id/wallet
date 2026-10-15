/** @jsxImportSource react */
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({
    status: { current: undefined as unknown },
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

const connected = (profileState: string, walletLink: string) => ({
    connection: "connected",
    profile: { id: "p", kind: "personal", state: profileState },
    walletLink,
    silentReconnect: false,
    environment: "sandbox",
});

describe("MoneriumConnect", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.disconnectError.current = null;
    });

    test("shows Complete setup while the profile is not approved", () => {
        mocks.status.current = connected("pending", "none");
        render(<MoneriumConnect />);

        fireEvent.click(screen.getByText("monerium.completeSetup"));
        expect(mocks.openModal).toHaveBeenCalledWith({
            id: "moneriumBankFlow",
        });
        expect(screen.getByText("monerium.disconnect")).toBeTruthy();
    });

    test("shows Complete setup while the wallet is not linked", () => {
        mocks.status.current = connected("approved", "none");
        render(<MoneriumConnect />);
        expect(screen.getByText("monerium.completeSetup")).toBeTruthy();
    });

    test("hides Complete setup once everything is done", () => {
        mocks.status.current = connected("approved", "linked");
        render(<MoneriumConnect />);
        expect(screen.queryByText("monerium.completeSetup")).toBeNull();
    });

    test("Disconnect only runs after the confirmation", async () => {
        mocks.status.current = connected("approved", "linked");
        render(<MoneriumConnect />);

        fireEvent.click(screen.getByText("monerium.disconnect"));
        expect(mocks.disconnect).not.toHaveBeenCalled();

        fireEvent.click(
            await screen.findByText("monerium.disconnectConfirm.confirm")
        );
        expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    });

    test("shows the disconnect failure", () => {
        mocks.status.current = connected("approved", "linked");
        mocks.disconnectError.current = new Error("boom");
        render(<MoneriumConnect />);
        expect(screen.getByText("monerium.errors.generic")).toBeTruthy();
    });
});
