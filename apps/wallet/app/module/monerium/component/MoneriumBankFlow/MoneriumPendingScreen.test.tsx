/** @jsxImportSource react */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { describe, expect, test } from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/module/monerium/hooks/useMoneriumStatus", () => ({
    useMoneriumStatus: () => ({
        refresh: mocks.refresh,
        isRefreshing: false,
        refreshError: new Error("boom"),
    }),
}));
vi.mock("@/module/notification/hook/useNotificationSetupStatus", () => ({
    useNotificationStatus: () => ({ isReady: false }),
}));
vi.mock("@/module/notification/hook/useSubscribeToPushNotification", () => ({
    useSubscribeToPushNotification: () => ({
        subscribeToPush: vi.fn(),
        isPending: false,
    }),
}));
vi.mock("./MoneriumScreen", () => ({
    MoneriumScreen: ({
        children,
        ctaLabel,
        ctaOnClick,
    }: {
        children: React.ReactNode;
        ctaLabel: string;
        ctaOnClick: () => void;
    }) => (
        <div>
            <button type="button" onClick={ctaOnClick}>
                {ctaLabel}
            </button>
            {children}
        </div>
    ),
}));

import { MoneriumPendingScreen } from "./MoneriumPendingScreen";

describe("MoneriumPendingScreen", () => {
    test("Check again shows the refresh error instead of swallowing it", async () => {
        mocks.refresh.mockRejectedValue(new Error("boom"));
        render(
            <MoneriumPendingScreen variant="verification" onClose={vi.fn()} />
        );

        fireEvent.click(
            screen.getByText("monerium.bankFlow.verification.checkAgain")
        );

        await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
        expect(screen.getByText("monerium.errors.generic")).toBeTruthy();
    });
});
