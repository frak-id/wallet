/** @jsxImportSource react */
import { currentStablecoins } from "@frak-labs/app-essentials";
import type * as WalletShared from "@frak-labs/wallet-shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { rampFlowStore } from "@/module/ramp/store/rampFlowStore";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({
    balances: { current: { eure: 50, usdc: 0 } },
    trackEvent: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "en" },
    }),
}));
vi.mock("@/module/ramp/utils/rampConfig", () => ({
    isEureSwapAvailable: true,
    RAMP_MIN_AMOUNT: 10,
}));
vi.mock("@frak-labs/wallet-shared", async (importOriginal) => ({
    ...(await importOriginal<typeof WalletShared>()),
    trackEvent: mocks.trackEvent,
    useGetUserBalance: () => ({
        isLoading: false,
        userBalance: {
            balances: [
                {
                    token: currentStablecoins.eure,
                    amount: mocks.balances.current.eure,
                },
                {
                    token: currentStablecoins.usdc,
                    amount: mocks.balances.current.usdc,
                },
            ],
        },
    }),
}));

import { RampAmountScreen } from "./RampAmountScreen";

const CONTINUE = "ramp.flow.amount.continue";

function typeAmount(value: string) {
    fireEvent.change(screen.getByRole("textbox"), { target: { value } });
}

const continueDisabled = () =>
    screen.getByRole("button", { name: CONTINUE }).hasAttribute("disabled");

describe("RampAmountScreen", () => {
    beforeEach(() => {
        rampFlowStore.getState().reset();
        mocks.balances.current = { eure: 50, usdc: 0 };
        mocks.trackEvent.mockReset();
    });

    test("blocks amounts under the Ramp minimum or above the balance", () => {
        render(<RampAmountScreen onClose={vi.fn()} />);

        typeAmount("5");
        expect(screen.getByText("ramp.flow.amount.minimum")).toBeTruthy();
        expect(continueDisabled()).toBe(true);

        typeAmount("60");
        expect(
            screen.getByText("ramp.flow.amount.insufficientBalance")
        ).toBeTruthy();
        expect(continueDisabled()).toBe(true);
    });

    test("an EURe amount continues to the swap step", () => {
        render(<RampAmountScreen onClose={vi.fn()} />);

        typeAmount("20");
        fireEvent.click(screen.getByRole("button", { name: CONTINUE }));

        expect(rampFlowStore.getState().screen).toBe("swap");
        expect(mocks.trackEvent).toHaveBeenCalledWith("ramp_offramp_started", {
            source: "eure",
        });
    });

    test("lands on USDC when only USDC is held, and goes straight to the widget", () => {
        mocks.balances.current = { eure: 0, usdc: 30 };
        render(<RampAmountScreen onClose={vi.fn()} />);

        expect(rampFlowStore.getState().source).toBe("usdc");
        typeAmount("20,5");
        fireEvent.click(screen.getByRole("button", { name: CONTINUE }));

        expect(rampFlowStore.getState()).toMatchObject({
            screen: "widget",
            usdcAmount: 20_500_000n,
        });
    });

    test("Max fills the whole balance", () => {
        render(<RampAmountScreen onClose={vi.fn()} />);

        fireEvent.click(screen.getByText("ramp.flow.amount.max"));

        expect(rampFlowStore.getState().amount).toBe("50.00");
    });
});
