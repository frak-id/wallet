/** @jsxImportSource react */
import { act, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, values?: { amount?: string }) =>
            values?.amount ? `${key} ${values.amount}` : key,
    }),
}));

import { MoneriumTransferSuccessModal } from "./MoneriumTransferSuccessModal";

describe("MoneriumTransferSuccessModal", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("shows the formatted amount in its title while open", () => {
        render(
            <MoneriumTransferSuccessModal
                open
                onOpenChange={vi.fn()}
                amount="€12.50"
            />
        );

        expect(
            screen.getAllByText(
                "monerium.bankFlow.transfer.success.title €12.50"
            ).length
        ).toBeGreaterThan(0);
    });

    test("dismisses itself after 5 seconds", () => {
        const onOpenChange = vi.fn();
        render(
            <MoneriumTransferSuccessModal
                open
                onOpenChange={onOpenChange}
                amount="€12.50"
            />
        );

        act(() => {
            vi.advanceTimersByTime(4_999);
        });
        expect(onOpenChange).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    });

    test("a closed modal never fires the dismissal", () => {
        const onOpenChange = vi.fn();
        render(
            <MoneriumTransferSuccessModal
                open={false}
                onOpenChange={onOpenChange}
                amount="€12.50"
            />
        );

        act(() => {
            vi.advanceTimersByTime(10_000);
        });
        expect(onOpenChange).not.toHaveBeenCalled();
    });
});
