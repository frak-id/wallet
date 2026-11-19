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

const { useVersionGateMock, hasUserInteractedMock, showBootSplashMock } =
    vi.hoisted(() => ({
        useVersionGateMock: vi.fn<() => VersionGateState>(),
        hasUserInteractedMock: vi.fn<() => boolean>(),
        showBootSplashMock: vi.fn(),
    }));

vi.mock("../hook/useVersionGate", () => ({
    useVersionGate: useVersionGateMock,
}));

vi.mock("@/utils/userInteraction", () => ({
    hasUserInteracted: hasUserInteractedMock,
}));

vi.mock("@/utils/bootSplash", () => ({
    showBootSplash: showBootSplashMock,
}));

vi.mock("./SoftUpdatePrompt", () => ({
    SoftUpdatePrompt: ({ mode }: { mode: string }) => <div>prompt:{mode}</div>,
}));

vi.mock("./HardUpdateGate", () => ({ HardUpdateGate: () => null }));

describe("VersionGate with a staged OTA bundle", () => {
    const reload = vi.fn();

    beforeEach(() => {
        reload.mockReset();
        showBootSplashMock.mockReset();
        hasUserInteractedMock.mockReset().mockReturnValue(false);
        useVersionGateMock.mockReset().mockReturnValue({ kind: "ota_ready" });
        sessionStore.getState().clearSession();
        vi.stubGlobal("location", { ...window.location, reload });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test("reloads behind the splash when logged out and untouched", () => {
        render(<VersionGate />);

        expect(showBootSplashMock).toHaveBeenCalledTimes(1);
        expect(reload).toHaveBeenCalledTimes(1);
        expect(screen.queryByText(/prompt:/)).toBeNull();
    });

    test("stays silent once a logged-out user has started something", () => {
        hasUserInteractedMock.mockReturnValue(true);

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
