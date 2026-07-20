/** @jsxImportSource react */
import type { Flow } from "@frak-labs/wallet-shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { usePushOptIn } from "./usePushOptIn";
import type { FlowStep, GoToStep } from "./useRegisterFlow";

const useNotificationStatus = vi.fn();
const subscribeToPushAsync = vi.fn();

vi.mock("@/module/notification/hook/useNotificationSetupStatus", () => ({
    useNotificationStatus: () => useNotificationStatus(),
}));
vi.mock("@/module/notification/hook/useSubscribeToPushNotification", () => ({
    useSubscribeToPushNotification: () => ({ subscribeToPushAsync }),
}));

type Status = {
    permissionStatus?: "granted" | "denied" | "default";
    permissionGranted?: boolean;
    hasBackendToken?: boolean;
};

function setup(step: FlowStep, status: Status = {}) {
    useNotificationStatus.mockReturnValue({
        permissionStatus: undefined,
        permissionGranted: false,
        hasBackendToken: false,
        ...status,
    });
    const track = vi.fn();
    const flowRef = { current: { track } as unknown as Flow };
    const goToStep = vi.fn() as unknown as GoToStep & ReturnType<typeof vi.fn>;
    const view = renderHook(() => usePushOptIn({ step, flowRef, goToStep }));
    return { ...view, track, goToStep };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("usePushOptIn onEnable", () => {
    test("tracks enabled and advances to welcome when subscribe resolves", async () => {
        subscribeToPushAsync.mockResolvedValue(undefined);
        const { result, track, goToStep } = setup("notification");

        await act(async () => {
            result.current.onEnable();
        });

        await waitFor(() =>
            expect(track).toHaveBeenCalledWith("notification_opt_in_resolved", {
                outcome: "enabled",
            })
        );
        expect(goToStep).toHaveBeenCalledWith("welcome");
    });

    test("tracks denied with the error reason when subscribe rejects", async () => {
        subscribeToPushAsync.mockRejectedValue(new Error("no permission"));
        const { result, track, goToStep } = setup("notification");

        await act(async () => {
            result.current.onEnable();
        });

        await waitFor(() =>
            expect(track).toHaveBeenCalledWith("notification_opt_in_resolved", {
                outcome: "denied",
                reason: "no permission",
            })
        );
        expect(goToStep).toHaveBeenCalledWith("welcome");
    });
});

describe("usePushOptIn onSkip", () => {
    test("tracks skipped and advances to welcome", () => {
        const { result, track, goToStep } = setup("notification");

        act(() => result.current.onSkip());

        expect(track).toHaveBeenCalledWith("notification_opt_in_resolved", {
            outcome: "skipped",
        });
        expect(goToStep).toHaveBeenCalledWith("welcome");
    });
});

describe("usePushOptIn auto-skip", () => {
    test("skips with auto_skipped_denied when permission is denied", () => {
        const { track, goToStep } = setup("notification", {
            permissionStatus: "denied",
        });

        expect(track).toHaveBeenCalledWith("notification_opt_in_resolved", {
            outcome: "auto_skipped_denied",
        });
        expect(goToStep).toHaveBeenCalledWith("welcome");
    });

    test("skips with auto_skipped_granted when already granted with a token", () => {
        const { track, goToStep } = setup("notification", {
            permissionGranted: true,
            hasBackendToken: true,
        });

        expect(track).toHaveBeenCalledWith("notification_opt_in_resolved", {
            outcome: "auto_skipped_granted",
        });
        expect(goToStep).toHaveBeenCalledWith("welcome");
    });

    test("does not auto-skip on other steps or unresolved permission", () => {
        const other = setup("welcome", { permissionStatus: "denied" });
        expect(other.goToStep).not.toHaveBeenCalled();

        const unresolved = setup("notification");
        expect(unresolved.goToStep).not.toHaveBeenCalled();
    });
});
