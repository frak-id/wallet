/** @jsxImportSource react */
import type * as WalletShared from "@frak-labs/wallet-shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { fail } from "@/tests/moneriumFixtures";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/module/monerium/utils/moneriumConfig", () => ({
    isMoneriumEnabled: false,
}));
vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual = await importOriginal<typeof WalletShared>();
    return {
        ...actual,
        authenticatedWalletApi: { monerium: { status: { get: mocks.get } } },
    };
});
vi.mock("@/module/notification/hook/useNotificationSetupStatus", () => ({
    useNotificationStatus: () => ({ isReady: false }),
}));
vi.mock("@/module/notification/hook/useSubscribeToPushNotification", () => ({
    useSubscribeToPushNotification: () => ({
        subscribeToPush: vi.fn(),
        isPending: false,
    }),
}));

import { MoneriumPendingScreen } from "./MoneriumPendingScreen";

const CHECK_AGAIN = "monerium.bankFlow.verification.checkAgain";

describe("MoneriumPendingScreen", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.get.mockResolvedValue(fail(502));
    });

    test("Check again shows the refresh error only after it fails", async ({
        queryWrapper,
    }) => {
        render(
            <MoneriumPendingScreen variant="verification" onClose={vi.fn()} />,
            { wrapper: queryWrapper.wrapper }
        );
        expect(screen.queryByText("monerium.errors.network")).toBeNull();

        fireEvent.click(screen.getByText(CHECK_AGAIN));

        expect(await screen.findByText("monerium.errors.network")).toBeTruthy();
        expect(mocks.get).toHaveBeenCalledWith({ query: { refresh: true } });
    });
});
