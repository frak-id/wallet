import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import { render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import {
    beforeEach,
    describe,
    expect,
    test,
    type WalletTestFixtures,
} from "@/tests/vitest-fixtures";
import type { VersionGateState } from "../hook/useVersionGate";
import { VersionGate } from "./VersionGate";

const { useVersionGateMock } = vi.hoisted(() => ({
    useVersionGateMock: vi.fn<() => VersionGateState>(),
}));

vi.mock("../hook/useVersionGate", () => ({
    useVersionGate: useVersionGateMock,
}));

vi.mock("./SoftUpdatePrompt", () => ({
    SoftUpdatePrompt: ({ mode }: { mode: string }) => <div>prompt:{mode}</div>,
}));

vi.mock("./HardUpdateGate", () => ({ HardUpdateGate: () => null }));

describe("VersionGate with a staged OTA bundle", () => {
    const reload = vi.fn();

    beforeEach(() => {
        reload.mockReset();
        useVersionGateMock.mockReset().mockReturnValue({ kind: "ota_ready" });
        sessionStore.getState().clearSession();
        vi.stubGlobal("location", { ...window.location, reload });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test("stays silent for a logged-out user, without reloading", () => {
        render(<VersionGate />);

        expect(reload).not.toHaveBeenCalled();
        expect(screen.queryByText(/prompt:/)).toBeNull();
    });

    test("offers the restart banner to a logged-in user", ({
        mockSession,
    }: WalletTestFixtures) => {
        sessionStore.getState().setSession(mockSession);

        render(<VersionGate />);

        expect(reload).not.toHaveBeenCalled();
        expect(screen.getByText("prompt:ota_ready")).toBeInTheDocument();
    });
});
